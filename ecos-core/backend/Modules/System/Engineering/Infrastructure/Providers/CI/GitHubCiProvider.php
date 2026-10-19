<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Infrastructure\Providers\CI;

use Illuminate\Support\Facades\Log;
use Modules\System\Engineering\Domain\Contracts\PipelineProviderInterface;
use Modules\System\Engineering\Domain\ValueObjects\CIResult;
use Symfony\Component\Process\Process;

final class GitHubCiProvider implements PipelineProviderInterface
{
    public function name(): string
    {
        return 'github';
    }

    public function supportsCI(): bool
    {
        return true;
    }

    public function checkWorkflowStatus(string $branch): CIResult
    {
        if (! preg_match('/^[a-zA-Z0-9._\\/\-]+$/', $branch)) {
            return CIResult::unavailable("Invalid branch name: '{$branch}'.");
        }

        $result = $this->runGhCli(
            "gh run list --branch " . escapeshellarg($branch) . " --limit 1 --json status,conclusion,url,databaseId --jq '.[0]' 2>&1"
        );

        if (! $result['success'] || blank($result['output'])) {
            return CIResult::unavailable('Could not query GitHub Actions (gh CLI returned no data).');
        }

        $data       = json_decode($result['output'], true);
        $status     = $data['status']     ?? 'unknown';
        $conclusion = $data['conclusion'] ?? null;
        $runUrl     = $data['url']        ?? null;
        $runId      = isset($data['databaseId']) ? (string) $data['databaseId'] : null;

        if ($status !== 'completed') {
            return CIResult::pending($runId, $runUrl);
        }

        if ($conclusion === 'success') {
            return CIResult::success($runId, $runUrl);
        }

        return CIResult::failure($conclusion ?? 'unknown', $runId, $runUrl);
    }

    public function waitForWorkflow(
        string $branch,
        int $maxWaitSeconds = 600,
        int $pollIntervalSeconds = 30,
        ?callable $onPoll = null,
    ): CIResult {
        $elapsed = 0;
        $lastResult = CIResult::pending();

        while ($elapsed < $maxWaitSeconds) {
            $lastResult = $this->checkWorkflowStatus($branch);

            if ($onPoll !== null) {
                $onPoll($lastResult, $elapsed);
            }

            if ($lastResult->completed) {
                return $lastResult;
            }

            sleep($pollIntervalSeconds);
            $elapsed += $pollIntervalSeconds;
        }

        return CIResult::timedOut($lastResult->runId, $lastResult->runUrl);
    }

    public function getWorkflowUrl(string $branch): ?string
    {
        if (! preg_match('/^[a-zA-Z0-9._\\/\-]+$/', $branch)) {
            return null;
        }

        $result = $this->runGhCli(
            "gh run list --branch " . escapeshellarg($branch) . " --limit 1 --json url --jq '.[0].url' 2>&1"
        );

        $url = trim($result['output'] ?? '');
        return ($result['success'] && str_starts_with($url, 'http')) ? $url : null;
    }

    /** @return array{success: bool, output: string} */
    private function runGhCli(string $command): array
    {
        try {
            $process = Process::fromShellCommandline($command);
            $process->setTimeout(30);
            $process->run();

            return [
                'success' => $process->isSuccessful(),
                'output'  => trim($process->getOutput() . $process->getErrorOutput()),
            ];
        } catch (\Throwable $e) {
            Log::error('GitHubCiProvider CLI error', ['command' => $command, 'error' => $e->getMessage()]);
            return ['success' => false, 'output' => $e->getMessage()];
        }
    }
}
