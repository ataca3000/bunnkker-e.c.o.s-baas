<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Fleet\Domain\Enums\DefectStatus;
use Modules\Logistics\Fleet\Domain\Events\DefectResolved;
use Modules\Logistics\Fleet\Domain\Exceptions\FleetException;
use Modules\Logistics\Fleet\Domain\Models\Defect;

/**
 * Defect lifecycle.
 *
 * Dismissing a CRITICAL defect is an override: it clears a safety blocker
 * without repairing anything, so it requires both the fleet.health.override
 * permission (enforced at the route) and a recorded reason (enforced here).
 * Every dismissal is audited.
 */
class DefectService
{
    public function __construct(
        private readonly FleetReadinessService $readiness,
        private readonly FleetUnitService $units,
    ) {}

    public function acknowledge(Defect $defect): Defect
    {
        $this->assertTransition($defect, DefectStatus::Acknowledged);

        $defect->update([
            'status' => DefectStatus::Acknowledged->value,
            'acknowledged_at' => now(),
        ]);

        return $defect->refresh();
    }

    public function startRepair(Defect $defect): Defect
    {
        $this->assertTransition($defect, DefectStatus::InRepair);

        $defect->update(['status' => DefectStatus::InRepair->value]);

        return $defect->refresh();
    }

    public function resolve(Defect $defect, ?int $actorId = null, ?string $actor = null): Defect
    {
        $this->assertTransition($defect, DefectStatus::Resolved);

        $unit = $defect->unit;
        $wasAssignable = $this->readiness->verdict($unit)->isAssignable();

        $resolved = DB::transaction(function () use ($defect, $actorId) {
            $defect->update([
                'status' => DefectStatus::Resolved->value,
                'resolved_at' => now(),
                'resolved_by' => $actorId,
            ]);

            return $defect->refresh();
        });

        DefectResolved::dispatch($resolved, $actor);
        $this->units->refreshFitness($unit, $wasAssignable, $actor);

        return $resolved;
    }

    public function reopen(Defect $defect, ?string $actor = null): Defect
    {
        $this->assertTransition($defect, DefectStatus::Reopened);

        $unit = $defect->unit;
        $wasAssignable = $this->readiness->verdict($unit)->isAssignable();

        $defect->update([
            'status' => DefectStatus::Reopened->value,
            'resolved_at' => null,
            'resolved_by' => null,
        ]);

        $this->units->refreshFitness($unit, $wasAssignable, $actor);

        return $defect->refresh();
    }

    /**
     * Close a defect without repairing it.
     *
     * $canOverride comes from the caller's permission check. A critical defect
     * cannot be dismissed without it — see FleetException.
     */
    public function dismiss(
        Defect $defect,
        string $reason,
        bool $canOverride,
        ?int $actorId = null,
        ?string $actor = null,
    ): Defect {
        $this->assertTransition($defect, DefectStatus::Dismissed);

        if (trim($reason) === '') {
            throw FleetException::dismissalReasonRequired();
        }

        if ($defect->requiresOverrideToDismiss() && ! $canOverride) {
            throw FleetException::criticalDefectDismissalRequiresOverride();
        }

        $unit = $defect->unit;
        $wasAssignable = $this->readiness->verdict($unit)->isAssignable();

        $defect->update([
            'status' => DefectStatus::Dismissed->value,
            'dismissal_reason' => $reason,
            'dismissed_by' => $actorId,
        ]);

        $this->units->refreshFitness($unit, $wasAssignable, $actor);

        return $defect->refresh();
    }

    private function assertTransition(Defect $defect, DefectStatus $target): void
    {
        if (! $defect->status->canTransitionTo($target)) {
            throw FleetException::invalidDefectTransition($defect->status, $target);
        }
    }
}
