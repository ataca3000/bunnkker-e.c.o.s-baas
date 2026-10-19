<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Fleet\Domain\Contracts\FleetReadinessQueryInterface;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;
use Modules\Logistics\Fleet\Domain\Enums\FleetUnitLifecycle;
use Modules\Logistics\Fleet\Domain\Enums\InspectionKind;
use Modules\Logistics\Fleet\Domain\Enums\InspectionStatus;
use Modules\Logistics\Fleet\Domain\Models\Defect;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Models\MaintenancePlan;
use Modules\Logistics\Fleet\Domain\ValueObjects\FitnessVerdict;
use Modules\Logistics\Fleet\Domain\ValueObjects\HealthScore;

/**
 * Is this vehicle fit to go out?
 *
 * ┌─ DIRECTIVE 3 — INDEPENDENCE ────────────────────────────────────────────┐
 * │ This class imports nothing from Distribution or Delivery. Its verdict is │
 * │ computable with both modules uninstalled — that is the whole point of    │
 * │ Fleet being a separate context rather than a folder.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ DIRECTIVE 5 — GPS OPTIONAL ────────────────────────────────────────────┐
 * │ No factor here reads a telemetry table. Every input is a physically      │
 * │ observed fact: a defect, a plan, an inspection, a document.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Two outputs, deliberately separate:
 *   • FitnessVerdict gates machines — "brake inspection lapsed 3 days ago"
 *   • HealthScore informs humans   — "61/100, worst factor: maintenance"
 * A dispatch rule cannot act on 61/100; it can act on a named blocker.
 */
class FleetReadinessService implements FleetReadinessQueryInterface
{
    /** Warn this far ahead of a due date or distance. */
    private const WARN_AHEAD_DAYS = 14;

    private const WARN_AHEAD_KM = 500;

    /** Vehicle documents expiring within this window are a warning, not a blocker. */
    private const DOCUMENT_WARN_DAYS = 30;

    public function verdictFor(int $vehicleId): FitnessVerdict
    {
        $unit = FleetUnit::query()
            ->where('vehicle_id', $vehicleId)
            ->with(['maintenancePlans', 'vehicle'])
            ->first();

        // A vehicle with no FleetUnit is not "unfit" — Fleet simply has no
        // opinion yet. Refusing here would block dispatch during onboarding.
        if ($unit === null) {
            return FitnessVerdict::noOpinion();
        }

        return $this->verdict($unit);
    }

    /**
     * @param  list<int>  $vehicleIds
     * @return array<int, FitnessVerdict>
     */
    public function verdictForMany(array $vehicleIds): array
    {
        if ($vehicleIds === []) {
            return [];
        }

        $units = FleetUnit::query()
            ->whereIn('vehicle_id', $vehicleIds)
            ->with(['maintenancePlans', 'vehicle'])
            ->get()
            ->keyBy('vehicle_id');

        $out = [];
        foreach ($vehicleIds as $vehicleId) {
            $unit = $units->get($vehicleId);
            $out[$vehicleId] = $unit === null
                ? FitnessVerdict::noOpinion()
                : $this->verdict($unit);
        }

        return $out;
    }

    /**
     * The full verdict for a unit already in hand.
     *
     * Blockers are ordered by how immediately they stop the vehicle: lifecycle
     * first (it is absolute), then safety, then compliance, then schedule.
     */
    public function verdict(FleetUnit $unit, ?Carbon $at = null): FitnessVerdict
    {
        $at ??= Carbon::today();
        $blockers = [];
        $warnings = [];

        // 1. Lifecycle — absolute, and cheap to check first.
        if (! $unit->isLifecycleDispatchable()) {
            $state = $unit->lifecycle_state;
            $blockers[] = $state === FleetUnitLifecycle::Suspended && $unit->lifecycle_reason
                ? "The unit is suspended: {$unit->lifecycle_reason}"
                : "The unit is {$state->label()}, not active.";
        }

        // 2. Safety — an open critical defect stops the vehicle immediately.
        $criticalDefects = $unit->defects()
            ->where('severity', DefectSeverity::Critical->value)
            ->whereNull('resolved_at')
            ->whereNull('dismissed_by')
            ->get();

        foreach ($criticalDefects as $defect) {
            $blockers[] = "Critical defect open: {$defect->title} (raised {$defect->ageInDays()}d ago).";
        }

        $majorCount = $unit->openDefectCount(DefectSeverity::Major);
        if ($majorCount > 0) {
            $warnings[] = $majorCount === 1
                ? '1 major defect is open.'
                : "{$majorCount} major defects are open.";
        }

        // 3. Compliance — mandatory inspections and vehicle documents.
        $this->appendInspectionFindings($unit, $at, $blockers, $warnings);
        $this->appendDocumentFindings($unit, $at, $blockers, $warnings);

        // 4. Schedule — maintenance due (warning) vs. overdue past grace (blocker).
        $this->appendMaintenanceFindings($unit, $at, $blockers, $warnings);

        return FitnessVerdict::from($blockers, $warnings);
    }

    /**
     * Derived health, for humans. Never stored — a stored score drifts from
     * reality the moment a defect is raised.
     */
    public function healthScore(FleetUnit $unit, ?Carbon $at = null): HealthScore
    {
        $at ??= Carbon::today();
        $weights = HealthScore::DEFAULT_WEIGHTS;

        $criticalCount = $unit->openDefectCount(DefectSeverity::Critical);
        $majorCount = $unit->openDefectCount(DefectSeverity::Major);
        $defectScore = $criticalCount > 0
            ? 0.0
            : max(0.0, 1.0 - ($majorCount * 0.25));

        $plans = $unit->maintenancePlans()->where('is_active', true)->with('rules')->get();
        $currentKm = $unit->current_odometer_km !== null ? (float) $unit->current_odometer_km : null;
        $overdue = $plans->filter(fn (MaintenancePlan $p) => $p->isOverdue($currentKm, $at))->count();
        $due = $plans->filter(fn (MaintenancePlan $p) => $p->isDue($currentKm, $at))->count();
        $maintenanceScore = match (true) {
            $overdue > 0 => 0.0,
            $due > 0 => 0.5,
            default => 1.0,
        };

        $inspectionScore = $this->hasLapsedMandatoryInspection($unit, $at) ? 0.0 : 1.0;
        $documentScore = $this->hasExpiredMandatoryDocument($unit, $at) ? 0.0 : 1.0;

        $efficiencyScore = $this->fuelEfficiencyScore($unit);
        $downtimeScore = $unit->hasOpenWorkOrder() ? 0.5 : 1.0;

        return HealthScore::fromFactors([
            'defects' => [
                'weight' => $weights['defects'],
                'score' => $defectScore,
                'note' => $criticalCount > 0
                    ? "{$criticalCount} critical defect(s) open"
                    : "{$majorCount} major defect(s) open",
            ],
            'maintenance' => [
                'weight' => $weights['maintenance'],
                'score' => $maintenanceScore,
                'note' => $overdue > 0 ? "{$overdue} plan(s) overdue" : "{$due} plan(s) due",
            ],
            'inspection' => [
                'weight' => $weights['inspection'],
                'score' => $inspectionScore,
                'note' => $inspectionScore === 1.0 ? 'Inspections current' : 'Mandatory inspection lapsed',
            ],
            'documents' => [
                'weight' => $weights['documents'],
                'score' => $documentScore,
                'note' => $documentScore === 1.0 ? 'Documents valid' : 'Expired document',
            ],
            'fuel_efficiency' => [
                'weight' => $weights['fuel_efficiency'],
                'score' => $efficiencyScore,
                'note' => $efficiencyScore >= 0.9 ? 'Within expected band' : 'Consumption above peers',
            ],
            'downtime' => [
                'weight' => $weights['downtime'],
                'score' => $downtimeScore,
                'note' => $downtimeScore === 1.0 ? 'No open work' : 'Work order open',
            ],
        ]);
    }

    // ── Finding builders ──────────────────────────────────────────────────────

    /**
     * @param  list<string>  $blockers
     * @param  list<string>  $warnings
     */
    private function appendMaintenanceFindings(
        FleetUnit $unit,
        Carbon $at,
        array &$blockers,
        array &$warnings,
    ): void {
        $currentKm = $unit->current_odometer_km !== null ? (float) $unit->current_odometer_km : null;

        $plans = $unit->maintenancePlans()->where('is_active', true)->get();

        foreach ($plans as $plan) {
            if ($plan->isOverdue($currentKm, $at)) {
                $blockers[] = "Maintenance overdue: {$plan->name}.";

                continue;
            }

            if ($plan->isDue($currentKm, $at)) {
                $warnings[] = "Maintenance due: {$plan->name}.";

                continue;
            }

            $days = $plan->daysUntilDue($at);
            if ($days !== null && $days >= 0 && $days <= self::WARN_AHEAD_DAYS) {
                $warnings[] = "{$plan->name} due in {$days} day(s).";

                continue;
            }

            $km = $plan->kmUntilDue($currentKm);
            if ($km !== null && $km >= 0 && $km <= self::WARN_AHEAD_KM) {
                $warnings[] = "{$plan->name} due in ".number_format($km).' km.';
            }
        }
    }

    /**
     * @param  list<string>  $blockers
     * @param  list<string>  $warnings
     */
    private function appendInspectionFindings(
        FleetUnit $unit,
        Carbon $at,
        array &$blockers,
        array &$warnings,
    ): void {
        foreach (InspectionKind::cases() as $kind) {
            if (! $kind->isMandatory()) {
                continue;
            }

            $interval = $kind->defaultIntervalDays();
            if ($interval === null) {
                continue;
            }

            $latest = $unit->inspections()
                ->where('kind', $kind->value)
                ->where('status', InspectionStatus::Approved->value)
                ->reorder('submitted_at', 'desc')
                ->first();

            if ($latest === null || $latest->submitted_at === null) {
                // The ABSENCE of a record is not evidence of a lapse. ECOS cannot
                // know whether a statutory or periodic inspection happened before
                // the vehicle was onboarded, so a missing record is a setup gap —
                // a warning — never a blocker. Only an inspection we HAVE on
                // record and that has since expired makes a vehicle unfit.
                //
                // This mirrors the document rule below: an expired document
                // blocks, a missing one does not. Blocking on absence would make
                // every vehicle unfit on go-live and train operators to reach for
                // fleet.health.override, which destroys the blocker's value.
                $warnings[] = "No {$kind->label()} inspection on record.";

                continue;
            }

            $dueOn = $latest->submitted_at->copy()->addDays($interval);
            $lapsedOn = $dueOn->copy()->addDays($kind->graceDays());

            if ($at->gt($lapsedOn)) {
                $lateDays = (int) $lapsedOn->diffInDays($at);
                $blockers[] = "{$kind->label()} inspection lapsed {$lateDays} day(s) ago.";
            } elseif ($at->gt($dueOn)) {
                $warnings[] = "{$kind->label()} inspection is due.";
            }
        }
    }

    /**
     * Reads LOG-003's logistics_vehicle_documents.expires_at.
     *
     * Directive 2 in miniature: the DATA stays in V1, only the JUDGEMENT is V2's.
     *
     * @param  list<string>  $blockers
     * @param  list<string>  $warnings
     */
    private function appendDocumentFindings(
        FleetUnit $unit,
        Carbon $at,
        array &$blockers,
        array &$warnings,
    ): void {
        $vehicle = $unit->vehicle;

        if ($vehicle === null) {
            return;
        }

        $documents = $vehicle->documents()->whereNotNull('expires_at')->get();

        foreach ($documents as $document) {
            $expiry = Carbon::parse($document->expires_at);

            if ($at->gt($expiry)) {
                $days = (int) $expiry->diffInDays($at);
                $blockers[] = "Document expired {$days} day(s) ago: {$document->title}.";

                continue;
            }

            $daysLeft = (int) $at->diffInDays($expiry, false);
            if ($daysLeft <= self::DOCUMENT_WARN_DAYS) {
                $warnings[] = "Document expires in {$daysLeft} day(s): {$document->title}.";
            }
        }
    }

    private function hasLapsedMandatoryInspection(FleetUnit $unit, Carbon $at): bool
    {
        $blockers = [];
        $warnings = [];
        $this->appendInspectionFindings($unit, $at, $blockers, $warnings);

        return $blockers !== [];
    }

    private function hasExpiredMandatoryDocument(FleetUnit $unit, Carbon $at): bool
    {
        $blockers = [];
        $warnings = [];
        $this->appendDocumentFindings($unit, $at, $blockers, $warnings);

        return $blockers !== [];
    }

    /**
     * How this vehicle's recent consumption compares with its own history.
     * Returns a perfect score when there is not enough data — an unmeasured
     * vehicle should not be penalised as if it were inefficient.
     */
    private function fuelEfficiencyScore(FleetUnit $unit): float
    {
        $recent = $unit->fuelTransactions()
            ->whereNotNull('efficiency_l_per_100km')
            ->limit(10)
            ->pluck('efficiency_l_per_100km');

        if ($recent->count() < 4) {
            return 1.0;
        }

        $values = $recent->map(static fn ($v) => (float) $v)->all();
        $latest = $values[0];
        $baseline = array_sum(array_slice($values, 1)) / max(1, count($values) - 1);

        if ($baseline <= 0.0) {
            return 1.0;
        }

        $deviation = ($latest - $baseline) / $baseline;

        return match (true) {
            $deviation <= 0.10 => 1.0,
            $deviation <= 0.25 => 0.6,
            default => 0.2,
        };
    }
}
