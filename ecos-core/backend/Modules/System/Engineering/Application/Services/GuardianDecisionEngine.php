<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Throwable;
use Modules\System\Engineering\Domain\Enums\GuardianDecision;
use Modules\System\Engineering\Domain\Enums\GuardianRunStatus;
use Modules\System\Engineering\Domain\Enums\ValidationStepStatus;
use Modules\System\Engineering\Domain\Models\GuardianCheck;
use Modules\System\Engineering\Domain\Models\GuardianDecisionLog;
use Modules\System\Engineering\Domain\Models\GuardianPolicy;
use Modules\System\Engineering\Domain\Models\GuardianRun;
use Modules\System\Engineering\Domain\Models\RepairMetric;

/**
 * Computes the final allow/block decision of a Guardian run
 * (TASK-ENG-V2-003 Autonomous Engineering Guardian).
 *
 * Hard invariants:
 *  (1) the decision is COMPUTED from check + validation state, never
 *      supplied by a caller;
 *  (2) no force-allow method exists anywhere in this class or the
 *      platform — a Block can only become an Allow through a fresh
 *      run whose checks actually pass;
 *  (3) every decision is logged append-only with a policy snapshot,
 *      so the exact rules in force at decision time are auditable.
 */
class GuardianDecisionEngine
{
    public function __construct(
        private readonly GuardianReportService $reportService,
        private readonly GuardianValidationCoordinator $validationCoordinator,
        private readonly AIMetricsEngine $supervisorMetrics,
    ) {
    }

    /**
     * Compute, persist, and log the decision for a Guardian run.
     */
    public function decide(GuardianRun $run, GuardianPolicy $policy, ?string $actorId = null): GuardianRun
    {
        $checks = $run->checks;

        /** @var Collection<int, GuardianCheck> $blockingFailures */
        $blockingFailures = $checks->filter(
            static fn (GuardianCheck $check): bool => $check->is_blocking
                && $check->status instanceof ValidationStepStatus
                && $check->status->isFailure()
        );

        $validationRejected = false;

        if ($run->validation_id) {
            $validationRejected = ! $this->validationCoordinator->validationAccepted($run);
        }

        $blocked = $blockingFailures->isNotEmpty() || $validationRejected;

        $decision = $blocked ? GuardianDecision::Block : GuardianDecision::Allow;

        $reason = $blocked
            ? 'Blocked: ' . $blockingFailures->count() . ' blocking check failure(s)'
                . ($validationRejected ? '; patch validation not accepted' : '')
                . ' — [' . $blockingFailures->pluck('check_name')->implode(', ') . ']'
            : 'All blocking checks passed'
                . ($run->validation_id ? ' and patch validation accepted' : '');

        GuardianDecisionLog::create([
            'run_id'          => $run->id,
            'company_id'      => $run->company_id,
            'decision'        => $decision->value,
            'reason'          => $reason,
            'decided_by'      => $actorId ?? 'system',
            'policy_snapshot' => $policy->only([
                'name',
                'auto_repair',
                'block_on',
                'enabled_checks',
                'max_repair_attempts',
                'require_revalidation',
            ]),
            'occurred_at'     => now(),
        ]);

        $run->update([
            'decision'        => $decision,
            'decision_reason' => $reason,
            'status'          => $blocked ? GuardianRunStatus::Failed : GuardianRunStatus::Passed,
            'completed_at'    => now(),
        ]);

        $this->reportService->generate($run->fresh(['checks']));

        $this->recordMetrics($run->fresh(), $decision, $blockingFailures->count());

        return $run->fresh();
    }

    /**
     * Guardian metrics (TASK-ENG-V2-003): decision outcomes recorded per
     * company for trend analysis, and mirrored into the AI Engineering
     * Supervisor metrics store. Metrics never affect the decision.
     */
    private function recordMetrics(GuardianRun $run, GuardianDecision $decision, int $blockingFailures): void
    {
        try {
            $dimensions = [
                'decision'          => $decision->value,
                'trigger_source'    => $run->trigger_source,
                'blocking_failures' => $blockingFailures,
                'auto_repaired'     => $run->repair_session_id !== null,
            ];

            RepairMetric::create([
                'company_id'   => $run->company_id,
                'metric_type'  => 'guardian',
                'metric_key'   => 'guardian.decision',
                'metric_value' => $decision === GuardianDecision::Allow ? 1.0 : 0.0,
                'dimensions'   => $dimensions,
                'recorded_at'  => now(),
            ]);

            $this->supervisorMetrics->record(
                $run->company_id,
                'guardian',
                'gate_decision',
                $decision === GuardianDecision::Allow ? 1.0 : 0.0,
                $dimensions,
            );
        } catch (Throwable) {
            // Metrics are best-effort; the decision and its audit log are
            // already persisted at this point.
        }
    }
}
