<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\GuardianRunStatus;
use Modules\System\Engineering\Domain\Models\GuardianRun;
use Modules\System\Engineering\Domain\Models\PatchValidation;
use Modules\System\Engineering\Domain\Models\RepairPatch;

/**
 * Coordinates re-validation of a Guardian run after a repair patch has been
 * received on the linked repair session (TASK-ENG-V2-003).
 *
 * Two-stage gate: (1) the patch itself is verified through the Self-Healing
 * Pipeline, and (2) the Guardian check suite is re-run against the patch
 * content. Never applies the patch — application remains a human decision
 * behind the RepairEngine gate (ADR-032 boundary).
 */
final class GuardianValidationCoordinator
{
    public function __construct(
        private readonly SelfHealingPipeline   $selfHealing,
        private readonly GuardianCheckRunner   $checkRunner,
        private readonly GuardianPolicyService $policyService,
    ) {}

    /**
     * Re-validate a Guardian run using the latest patch on its linked
     * repair session.
     *
     * @throws \RuntimeException when no repair session is linked or no patch has been received yet
     */
    public function revalidate(GuardianRun $run, ?string $actorId = null): GuardianRun
    {
        if (! $run->repair_session_id) {
            throw new \RuntimeException('Guardian run has no linked repair session');
        }

        $patch = RepairPatch::where('session_id', $run->repair_session_id)
            ->orderByDesc('created_at')
            ->first();

        if (! $patch) {
            throw new \RuntimeException('No patch received on the linked repair session yet');
        }

        $run->update(['status' => GuardianRunStatus::Revalidating]);

        // 1. Patch verification via the Self-Healing Pipeline.
        $validation = $this->selfHealing->startValidation($patch, $actorId);
        $validation = $this->selfHealing->execute($validation);

        // 2. Re-run guardian checks against the patch content.
        $run->checks()->delete();

        $policy = $this->policyService->resolveFor($run->company_id);
        $this->checkRunner->runChecks($run->fresh(), $policy, $patch->patch_content ?? '');

        $run->update(['validation_id' => $validation->id]);

        return $run->fresh(['checks']);
    }

    /**
     * Whether the Self-Healing Pipeline validation linked to this run
     * ended with an accepted verdict.
     */
    public function validationAccepted(GuardianRun $run): bool
    {
        if (! $run->validation_id) {
            return false;
        }

        $validation = PatchValidation::find($run->validation_id);

        if (! $validation) {
            return false;
        }

        $verdict = $validation->verdict;
        $value   = $verdict instanceof \BackedEnum ? $verdict->value : $verdict;

        return $value === 'accepted';
    }
}
