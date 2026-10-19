<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;
use Modules\Logistics\Fleet\Domain\Enums\InspectionKind;
use Modules\Logistics\Fleet\Domain\Enums\InspectionStatus;
use Modules\Logistics\Fleet\Domain\Enums\OdometerSource;
use Modules\Logistics\Fleet\Domain\Events\DefectRaised;
use Modules\Logistics\Fleet\Domain\Events\InspectionApproved;
use Modules\Logistics\Fleet\Domain\Events\InspectionRejected;
use Modules\Logistics\Fleet\Domain\Events\InspectionSubmitted;
use Modules\Logistics\Fleet\Domain\Exceptions\FleetException;
use Modules\Logistics\Fleet\Domain\Models\Defect;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Models\Inspection;
use Modules\Logistics\Fleet\Domain\Models\InspectionTemplate;
use Modules\Logistics\Fleet\Domain\Models\InspectionTemplateItem;

/**
 * Checklists, their outcomes, and the defects they raise.
 *
 * Two rules carried over from LOG-005's proof-of-delivery design, for the same
 * reason — evidence should not be self-certified:
 *
 *   1. An inspection is IMMUTABLE once submitted. A mistake is corrected by a
 *      new inspection, never by editing the old one.
 *   2. An inspection with a critical failure may not be approved by the person
 *      who performed it.
 *
 * Directive 4: the driver's phone submits the checklist. Whether the outcome
 * makes the vehicle unfit is decided HERE, on the server.
 */
class InspectionService
{
    public function __construct(
        private readonly OdometerService $odometer,
        private readonly FleetReadinessService $readiness,
        private readonly FleetUnitService $units,
    ) {}

    /**
     * Open a draft inspection, snapshotting the template version so this
     * inspection stays readable after the template moves on.
     */
    public function start(
        FleetUnit $unit,
        InspectionTemplate $template,
        InspectionKind $kind,
        ?float $odometerKm = null,
        ?int $actorId = null,
    ): Inspection {
        return DB::transaction(function () use ($unit, $template, $kind, $odometerKm, $actorId) {
            $inspection = $unit->inspections()->create([
                'company_id' => $unit->company_id,
                'template_id' => $template->id,
                'template_version' => $template->version,
                'status' => InspectionStatus::Draft->value,
                'kind' => $kind->value,
                'odometer_km' => $odometerKm,
                'performed_at' => now(),
                'performed_by' => $actorId,
            ]);

            if ($odometerKm !== null) {
                $this->odometer->record(
                    $unit,
                    $odometerKm,
                    OdometerSource::Inspection,
                    sourceReference: $inspection->uuid,
                    actorId: $actorId,
                );
            }

            return $inspection->refresh();
        });
    }

    /**
     * Record answers and submit.
     *
     * @param  array<string, array{passed: bool, comment?: string|null, photos?: list<string>}>  $answers
     *                                                                                                   Keyed by template item code.
     */
    public function submit(Inspection $inspection, array $answers, ?int $actorId = null): Inspection
    {
        if ($inspection->isImmutable()) {
            throw FleetException::inspectionIsImmutable();
        }

        $inspection->loadMissing('template.items');
        $items = $inspection->template?->items ?? collect();

        $missing = $items
            ->where('is_mandatory', true)
            ->filter(fn (InspectionTemplateItem $item) => ! array_key_exists($item->code, $answers))
            ->pluck('label')
            ->values()
            ->all();

        if ($missing !== []) {
            throw FleetException::inspectionMissingMandatoryItems($missing);
        }

        $submitted = DB::transaction(function () use ($inspection, $items, $answers, $actorId) {
            $inspection->results()->delete();

            $failedCount = 0;
            $hasCritical = false;

            foreach ($items as $item) {
                if (! array_key_exists($item->code, $answers)) {
                    continue;
                }

                $answer = $answers[$item->code];
                $passed = (bool) ($answer['passed'] ?? true);

                if (! $passed) {
                    $failedCount++;
                    if ($item->failure_severity->blocksFitness()) {
                        $hasCritical = true;
                    }
                }

                $inspection->results()->create([
                    'template_item_id' => $item->id,
                    'item_code' => $item->code,
                    'item_label' => $item->label,
                    'failure_severity' => $item->failure_severity->value,
                    'passed' => $passed,
                    'comment' => $answer['comment'] ?? null,
                    'photos' => empty($answer['photos']) ? null : $answer['photos'],
                ]);
            }

            $inspection->update([
                'status' => InspectionStatus::Submitted->value,
                'submitted_at' => now(),
                'performed_by' => $inspection->performed_by ?? $actorId,
                'failed_item_count' => $failedCount,
                'has_critical_failure' => $hasCritical,
            ]);

            return $inspection->refresh();
        });

        InspectionSubmitted::dispatch($submitted);

        return $submitted;
    }

    /**
     * Approve. Failed items become defects, and a critical defect flips the
     * vehicle's fitness immediately.
     */
    public function approve(Inspection $inspection, ?int $actorId = null, ?string $actor = null): Inspection
    {
        $this->assertTransition($inspection, InspectionStatus::Approved);

        if (! $inspection->canBeApprovedBy($actorId)) {
            throw FleetException::approverMustDifferFromPerformer();
        }

        $unit = $inspection->unit;
        $wasAssignable = $this->readiness->verdict($unit)->isAssignable();

        $approved = DB::transaction(function () use ($inspection, $unit, $actorId) {
            $inspection->update([
                'status' => InspectionStatus::Approved->value,
                'reviewed_at' => now(),
                'approved_by' => $actorId,
            ]);

            $inspection->loadMissing('results');

            foreach ($inspection->results->where('passed', false) as $result) {
                $defect = Defect::create([
                    'fleet_unit_id' => $unit->id,
                    'inspection_id' => $inspection->id,
                    'company_id' => $unit->company_id,
                    'severity' => $result->failure_severity->value,
                    'title' => $result->item_label,
                    'description' => $result->comment,
                    'photos' => $result->photos,
                    'reported_at' => now(),
                    'reported_by' => $inspection->performed_by,
                ]);

                DefectRaised::dispatch($defect);
            }

            return $inspection->refresh();
        });

        InspectionApproved::dispatch($approved, $actor);
        $this->units->refreshFitness($unit, $wasAssignable, $actor);

        return $approved;
    }

    public function reject(Inspection $inspection, string $reason, ?int $actorId = null): Inspection
    {
        $this->assertTransition($inspection, InspectionStatus::Rejected);

        if (trim($reason) === '') {
            throw FleetException::rejectionReasonRequired();
        }

        $inspection->update([
            'status' => InspectionStatus::Rejected->value,
            'reviewed_at' => now(),
            'approved_by' => $actorId,
            'rejection_reason' => $reason,
        ]);

        InspectionRejected::dispatch($inspection->refresh());

        return $inspection->refresh();
    }

    /**
     * Raise a defect outside an inspection — a driver noticing a fault mid-shift.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function reportDefect(
        FleetUnit $unit,
        array $attributes,
        DefectSeverity $severity,
        ?int $actorId = null,
        ?string $actor = null,
    ): Defect {
        $wasAssignable = $this->readiness->verdict($unit)->isAssignable();

        $defect = Defect::create($attributes + [
            'fleet_unit_id' => $unit->id,
            'company_id' => $unit->company_id,
            'severity' => $severity->value,
            'reported_at' => now(),
            'reported_by' => $actorId,
        ]);

        DefectRaised::dispatch($defect, $actor);
        $this->units->refreshFitness($unit, $wasAssignable, $actor);

        return $defect;
    }

    private function assertTransition(Inspection $inspection, InspectionStatus $target): void
    {
        if (! $inspection->status->canTransitionTo($target)) {
            throw FleetException::invalidInspectionTransition($inspection->status, $target);
        }
    }
}
