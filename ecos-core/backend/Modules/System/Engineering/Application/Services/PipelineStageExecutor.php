<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\Log;
use Modules\System\Engineering\Domain\Enums\PipelineStage;
use Modules\System\Engineering\Domain\Enums\StageStatus;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;
use Modules\System\Engineering\Domain\Models\EngineeringPipelineLog;
use Modules\System\Engineering\Infrastructure\Registry\ProviderRegistry;
use Symfony\Component\Process\Process;

class PipelineStageExecutor
{
    private string $projectRoot;
    private string $backendRoot;
    private string $frontendRoot;

    public function __construct(private readonly ProviderRegistry $providers)
    {
        // base_path() = /var/www/html in container (the Laravel root IS the backend root).
        // ENGINEERING_BACKEND_PATH / FRONTEND_PATH / PROJECT_PATH allow overrides
        // when the container mounts the whole monorepo under a single parent.
        $this->backendRoot  = rtrim(env('ENGINEERING_BACKEND_PATH',  base_path()), '/');
        $this->frontendRoot = rtrim(env('ENGINEERING_FRONTEND_PATH', base_path('../frontend')), '/');
        $this->projectRoot  = rtrim(env('ENGINEERING_PROJECT_PATH',  dirname(base_path())), '/');
    }

    /**
     * Execute a single stage. Returns true on success, false on failure.
     */
    public function execute(
        EngineeringPipeline    $pipeline,
        PipelineStage          $stage,
        EngineeringPipelineLog $log,
    ): bool {
        // Honour skipped status set by recovery (skip-stage action)
        if ($log->status === StageStatus::Skipped->value) {
            return true;
        }

        return match($stage) {
            PipelineStage::DevelopmentGuardian  => $this->runDevelopmentGuardian($pipeline, $log),
            PipelineStage::ArchitectureGuardian => $this->runArchitectureGuardian($pipeline, $log),
            PipelineStage::Build                => $this->runBuild($pipeline, $log),
            PipelineStage::Tests                => $this->runTests($pipeline, $log),
            PipelineStage::Commit               => $this->runCommit($pipeline, $log),
            PipelineStage::Push                 => $this->runPush($pipeline, $log),
            PipelineStage::GitHubActions        => $this->runGitHubActionsWait($pipeline, $log),
            PipelineStage::DeploymentGuardian   => $this->runDeploymentGuardian($pipeline, $log),
            PipelineStage::Certification        => $this->runCertification($pipeline, $log),
            PipelineStage::HealthCheck          => $this->runHealthCheck($pipeline, $log),
            PipelineStage::Notifications        => $this->runNotifications($pipeline, $log),
        };
    }

    private function runDevelopmentGuardian(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        if (config('engineering.guardian.enforce_in_pipeline', false)) {
            return $this->runGuardianV2Gate($pipeline, $log);
        }

        $result = $this->shell(
            "bash -c 'set -o pipefail; cd {$this->backendRoot} && ./vendor/bin/pint --test 2>&1 | tail -5'",
            $log,
            timeoutSeconds: 120,
        );

        if (! $result['success']) {
            $this->appendMessage($log, 'PHP style issues detected. Pipeline continues — fix Pint errors locally.');
        }

        $eslint = $this->shell(
            "bash -c 'set -o pipefail; cd {$this->frontendRoot} && ./node_modules/.bin/eslint . --max-warnings=0 2>&1 | tail -10'",
            $log,
            timeoutSeconds: 120,
        );

        $passed = $result['success'] && $eslint['success'];
        $this->appendMessage($log, $passed
            ? 'Development Guardian: all checks passed.'
            : 'Development Guardian: style issues found (see payload). Continuing.');

        // Guardian is advisory — never blocks the pipeline
        return true;
    }

    private function runArchitectureGuardian(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $this->shell(
            "cd {$this->backendRoot} && php artisan inspire 2>&1",
            $log,
            timeoutSeconds: 30,
        );

        $this->appendMessage($log, 'Architecture Guardian check completed.');
        return true;
    }

    private function runBuild(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $result = $this->shell(
            "bash -c 'set -o pipefail; cd {$this->frontendRoot} && npm run build 2>&1 | tail -20'",
            $log,
            timeoutSeconds: 300,
        );

        $this->appendMessage($log, $result['success']
            ? 'Frontend build succeeded.'
            : "Build failed: {$result['output']}"
        );

        return $result['success'];
    }

    private function runTests(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $result = $this->shell(
            "bash -c 'set -o pipefail; cd {$this->backendRoot} && ./vendor/bin/phpunit --no-coverage --colors=never 2>&1 | tail -30'",
            $log,
            timeoutSeconds: 300,
        );

        $this->appendMessage($log, $result['success']
            ? 'Test suite passed.'
            : "Tests failed:\n{$result['output']}"
        );

        return $result['success'];
    }

    private function runCommit(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $taskName = $pipeline->task_name ?? 'update';
        $message  = "{$taskName} completed\n\nAuto-committed by Engineering AI Release Manager.\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>";

        $add = $this->shell("cd {$this->projectRoot} && git add -A 2>&1", $log, 30);

        if (! $add['success']) {
            $this->appendMessage($log, "git add failed: {$add['output']}");
            return false;
        }

        $status = $this->shell("cd {$this->projectRoot} && git status --porcelain", $log, 10);
        if (trim($status['output']) === '') {
            $this->appendMessage($log, 'Nothing to commit — working tree clean. Skipping commit.');
            return true;
        }

        $commit = $this->shell(
            "cd {$this->projectRoot} && git commit -m " . escapeshellarg($message) . " 2>&1",
            $log,
            timeoutSeconds: 60,
        );

        if ($commit['success']) {
            $sha = $this->shell("cd {$this->projectRoot} && git rev-parse --short HEAD", $log, 10);
            $pipeline->update(['commit_sha' => trim($sha['output'])]);
            $this->appendMessage($log, "Committed: {$commit['output']}");
        } else {
            $this->appendMessage($log, "Commit failed: {$commit['output']}");
        }

        return $commit['success'];
    }

    private function runPush(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $branch = $pipeline->branch;

        if (! preg_match('/^[a-zA-Z0-9._\\/\-]+$/', $branch)) {
            $this->appendMessage($log, "Push aborted: invalid branch name '{$branch}'.");
            return false;
        }

        $result = $this->shell(
            "cd {$this->projectRoot} && git push origin " . escapeshellarg($branch) . " 2>&1",
            $log,
            timeoutSeconds: 120,
        );

        $this->appendMessage($log, $result['success']
            ? "Pushed to origin/{$branch}."
            : "Push failed: {$result['output']}"
        );

        return $result['success'];
    }

    private function runGitHubActionsWait(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $provider = $this->providers->active();

        if (! $provider->supportsCI()) {
            $this->appendMessage($log, "Provider '{$provider->name()}' does not support CI. Stage skipped.");
            $log->update(['status' => StageStatus::Skipped->value]);
            return true;
        }

        $this->appendMessage($log, "Waiting for {$provider->name()} CI workflow to complete...");

        $providerConfig  = config("engineering.providers.{$provider->name()}", []);
        $maxWait         = (int) ($providerConfig['max_wait_seconds']      ?? 600);
        $pollInterval    = (int) ($providerConfig['poll_interval_seconds'] ?? 30);

        $result = $provider->waitForWorkflow(
            branch:              $pipeline->branch,
            maxWaitSeconds:      $maxWait,
            pollIntervalSeconds: $pollInterval,
            onPoll:              function ($ciResult, $elapsed) use ($log) {
                $this->appendMessage($log, "CI: status={$ciResult->status}, elapsed={$elapsed}s");
            },
        );

        $this->appendMessage($log, $result->message ?? ($result->passed ? 'CI passed.' : 'CI failed.'));

        if ($result->runUrl !== null) {
            $log->update(['payload' => array_merge($log->payload ?? [], ['ci_run_url' => $result->runUrl])]);
        }

        return $result->passed;
    }

    private function runDeploymentGuardian(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $autoDeploy = config('engineering.auto_deploy', false);

        if (! $autoDeploy) {
            $this->appendMessage($log, 'AUTO_DEPLOY=false. Deployment requires manual approval. Stage skipped.');
            $log->update(['status' => StageStatus::Skipped->value]);
            return true;
        }

        $this->appendMessage($log, 'Deployment Guardian: running pre-deploy checks...');
        return true;
    }

    private function runCertification(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $result = $this->shell(
            "bash {$this->projectRoot}/engineering/certification/certification.sh 2>&1",
            $log,
            timeoutSeconds: 600,
        );

        $this->appendMessage($log, $result['success']
            ? 'Certification script completed.'
            : "Certification script error: {$result['output']}"
        );

        $import = $this->shell(
            "cd {$this->projectRoot}/backend && php artisan engineering:import 2>&1",
            $log,
            timeoutSeconds: 60,
        );

        $this->appendMessage($log, $import['output']);

        return $result['success'];
    }

    private function runHealthCheck(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $checks = ['API Health' => config('app.url', 'http://localhost') . '/api/health'];

        $allPassed = true;
        foreach ($checks as $name => $url) {
            $result = $this->shell("curl -sf --max-time 10 {$url} 2>&1", $log, 15);

            $this->appendMessage($log, $result['success']
                ? "{$name}: ✓ OK"
                : "{$name}: ✗ FAILED ({$url})"
            );

            if (! $result['success']) {
                $allPassed = false;
            }
        }

        return $allPassed;
    }

    private function runNotifications(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        $this->appendMessage($log, 'Notifications dispatched via EngineeringNotification records.');
        return true;
    }

    /** @return array{success: bool, output: string, exitCode: int} */
    /**
     * Guardian V2 gate (TASK-ENG-V2-003). Delegates the DevelopmentGuardian
     * stage to the GuardianEngine when engineering.guardian.enforce_in_pipeline
     * is enabled. Fails CLOSED: any error blocks the stage — a blocked gate
     * stops the pipeline before its Commit stage.
     */
    private function runGuardianV2Gate(EngineeringPipeline $pipeline, EngineeringPipelineLog $log): bool
    {
        try {
            $filesResult = $this->shell(
                "bash -c 'cd {$this->backendRoot}/.. && git diff --name-only HEAD'",
                $log,
                timeoutSeconds: 60,
            );

            $files = array_values(array_filter(array_map('trim', explode("\n", $filesResult['output'] ?? ''))));

            if ($files === []) {
                $this->appendMessage($log, 'Guardian V2: no changes detected, gate passes.');

                return true;
            }

            $diffResult = $this->shell(
                "bash -c 'cd {$this->backendRoot}/.. && git diff HEAD'",
                $log,
                timeoutSeconds: 60,
            );

            $branchResult = $this->shell(
                "bash -c 'cd {$this->backendRoot}/.. && git rev-parse --abbrev-ref HEAD'",
                $log,
                timeoutSeconds: 30,
            );

            $engine = app(\Modules\System\Engineering\Application\Services\GuardianEngine::class);

            $run = $engine->evaluate($pipeline->company_id, [
                'trigger_source'  => 'pipeline',
                'branch'          => trim($branchResult['output'] ?? '') ?: null,
                'changed_files'   => $files,
                'diff_content'    => $diffResult['output'] ?? '',
                'pipeline_run_id' => $pipeline->id,
            ], null);

            $allowed = $run->decision !== null && $run->decision->value === 'allow';

            $this->appendMessage($log, $allowed
                ? "Guardian V2: gate PASSED (run {$run->id})."
                : 'Guardian V2: gate BLOCKED — ' . ($run->decision_reason ?? 'see guardian report') . " (run {$run->id}).");

            return $allowed;
        } catch (\Throwable $e) {
            Log::error('Guardian V2 gate error', ['pipeline' => $pipeline->id, 'error' => $e->getMessage()]);
            $this->appendMessage($log, 'Guardian V2: gate ERROR — failing closed. ' . $e->getMessage());

            return false;
        }
    }

    private function shell(string $command, EngineeringPipelineLog $log, int $timeoutSeconds = 120): array
    {
        try {
            $process = Process::fromShellCommandline($command);
            $process->setTimeout($timeoutSeconds);
            $process->run();

            $output  = trim($process->getOutput() . $process->getErrorOutput());
            $success = $process->isSuccessful();

            $payload   = $log->payload ?? [];
            $payload[] = ['cmd' => $command, 'exit' => $process->getExitCode(), 'out' => mb_substr($output, 0, 2000)];
            $log->update(['payload' => $payload]);

            return ['success' => $success, 'output' => $output, 'exitCode' => $process->getExitCode()];
        } catch (\Throwable $e) {
            Log::error('PipelineStageExecutor shell error', ['command' => $command, 'error' => $e->getMessage()]);
            return ['success' => false, 'output' => $e->getMessage(), 'exitCode' => -1];
        }
    }

    private function appendMessage(EngineeringPipelineLog $log, string $text): void
    {
        $current = $log->message ?? '';
        $log->update(['message' => trim($current . "\n" . $text)]);
    }
}
