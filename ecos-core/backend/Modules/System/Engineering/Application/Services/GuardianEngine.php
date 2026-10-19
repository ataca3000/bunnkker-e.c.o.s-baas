<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Log;
use Modules\System\Engineering\Domain\Enums\GuardianRunStatus;
use Modules\System\Engineering\Domain\Models\GuardianRun;
use RuntimeException;

/**
 * Facade for the autonomous quality gate
 * (TASK-ENG-V2-003 Autonomous Engineering Guardian).
 *
 * Flow: evaluate -> checks -> (auto repair orchestration if policy
 * allows) -> decision.
 *
 * The Guardian never executes git commands and never commits; it
 * returns an allow/block decision that a pre-commit hook or pipeline
 * stage enforces.
 */
class GuardianEngine
{
    public function __construct(
        private readonly GuardianPolicyService $policyService,
        private readonly GuardianCheckRunner $checkRunner,
        private readonly GuardianRepairOrchestrator $repairOrchestrator,
        private readonly GuardianValidationCoordinator $validationCoordinator,
        private readonly GuardianDecisionEngine $decisionEngine,
    ) {
    }

    /**
     * Run the full Guardian gate for a proposed change set.
     *
     * $payload keys: trigger_source (default manual), commit_ref, branch,
     * changed_files (array), diff_content (string), pipeline_run_id.
     */
    public function evaluate(string $companyId, array $payload, ?string $actorId = null): GuardianRun
    {
        $policy = $this->policyService->resolveFor($companyId);

        $changedFiles = $payload['changed_files'] ?? [];
        $diffContent  = $payload['diff_content'] ?? '';

        $run = GuardianRun::create([
            'company_id'      => $companyId,
            'trigger_source'  => $payload['trigger_source'] ?? 'manual',
            'commit_ref'      => $payload['commit_ref'] ?? null,
            'branch'          => $payload['branch'] ?? null,
            'initiated_by'    => $actorId,
            'status'          => GuardianRunStatus::RunningChecks,
            'changed_files'   => $changedFiles,
            'diff_stats'      => [
                'files' => count($changedFiles),
                'bytes' => strlen($diffContent),
            ],
            'policy_id'       => $policy->exists ? $policy->id : null,
            'pipeline_run_id' => $payload['pipeline_run_id'] ?? null,
            'started_at'      => now(),
        ]);

        $checks = $this->checkRunner->runChecks($run, $policy, $diffContent);

        $run->refresh();

        $failed = collect($checks)->filter(
            static fn ($check): bool => in_array($check->status->value ?? $check->status, ['failed', 'error'], true)
        );

        if ($failed->isNotEmpty() && $policy->auto_repair) {
            try {
                $this->repairOrchestrator->orchestrate($run, $failed, $actorId);
            } catch (\Throwable $e) {
                Log::warning('Guardian auto-repair orchestration failed', [
                    'run'   => $run->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // The decision is always computed immediately so the gate answer is
        // never deferred: if a repair session was opened, decide() still sets
        // the terminal status (Failed/Block). Contract: terminal status
        // reflects the decision; repair_session_id != null signals an open
        // repair loop, and the run history shows the repair path.
        return $this->decisionEngine->decide($run->fresh(), $policy, $actorId);
    }

    /**
     * Re-run patch validation for a run and recompute its decision.
     *
     * Retry coordination (TASK-ENG-V2-003): the active policy's
     * max_repair_attempts caps how many repair/re-validation cycles a
     * single run may consume. The cap is deterministic and audited via
     * the decision log — each cycle appends one decision row.
     */
    public function revalidateAndDecide(GuardianRun $run, ?string $actorId = null): GuardianRun
    {
        $policy = $this->policyService->resolveFor($run->company_id);

        $maxAttempts = max(1, (int) ($policy->max_repair_attempts ?? 2));
        $priorCycles = max(0, $run->decisions()->count() - 1);

        if ($priorCycles >= $maxAttempts) {
            throw new \RuntimeException(
                "Maximum repair attempts ({$maxAttempts}) exhausted for this Guardian run. "
                . 'Open a fresh run after repairing the change.'
            );
        }

        $run = $this->validationCoordinator->revalidate($run, $actorId);

        return $this->decisionEngine->decide($run, $policy, $actorId);
    }

    public function get(string $id, string $companyId): GuardianRun
    {
        return GuardianRun::with(['checks', 'report', 'decisions'])
            ->where('company_id', $companyId)
            ->findOrFail($id);
    }

    public function list(string $companyId, array $filters = []): LengthAwarePaginator
    {
        $query = GuardianRun::query()->where('company_id', $companyId);

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['decision'])) {
            $query->where('decision', $filters['decision']);
        }

        if (! empty($filters['trigger_source'])) {
            $query->where('trigger_source', $filters['trigger_source']);
        }

        if (! empty($filters['branch'])) {
            $query->where('branch', $filters['branch']);
        }

        return $query
            ->orderByDesc('created_at')
            ->paginate($filters['per_page'] ?? 15);
    }

    public function cancel(GuardianRun $run, ?string $actorId = null): GuardianRun
    {
        if ($run->isTerminal()) {
            throw new RuntimeException('Guardian run is already terminal and cannot be cancelled.');
        }

        $run->update([
            'status'       => GuardianRunStatus::Cancelled,
            'completed_at' => now(),
        ]);

        return $run->fresh();
    }

    public function dashboard(string $companyId): array
    {
        $base = GuardianRun::query()->where('company_id', $companyId);

        $totalRuns = (clone $base)->count();

        $runsToday = (clone $base)->whereDate('created_at', today())->count();

        $blockedToday = (clone $base)
            ->whereDate('created_at', today())
            ->where('decision', 'block')
            ->count();

        $allowedToday = (clone $base)
            ->whereDate('created_at', today())
            ->where('decision', 'allow')
            ->count();

        $terminalStatuses = ['passed', 'failed', 'error', 'cancelled'];

        $terminalCount = (clone $base)->whereIn('status', $terminalStatuses)->count();

        $terminalBlocked = (clone $base)
            ->whereIn('status', $terminalStatuses)
            ->where('decision', 'block')
            ->count();

        $blockRate = $terminalCount > 0
            ? round(($terminalBlocked / $terminalCount) * 100, 1)
            : 0;

        $activeRuns = (clone $base)->whereNotIn('status', $terminalStatuses)->count();

        $recentRuns = (clone $base)
            ->withCount('checks')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        $byTriggerSource = (clone $base)
            ->get(['trigger_source'])
            ->groupBy('trigger_source')
            ->map(static fn ($group) => $group->count());

        return [
            'total_runs'        => $totalRuns,
            'runs_today'        => $runsToday,
            'blocked_today'     => $blockedToday,
            'allowed_today'     => $allowedToday,
            'block_rate'        => $blockRate,
            'active_runs'       => $activeRuns,
            'recent_runs'       => $recentRuns,
            'by_trigger_source' => $byTriggerSource,
        ];
    }
}
