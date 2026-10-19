<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Compensation\Domain\Enums\DeductionType;
use Modules\Hr\Compensation\Domain\Services\DeductionService;
use Modules\Hr\Performance\Domain\Enums\IncidentCategory;
use Modules\Hr\Performance\Domain\Models\EmployeeIncident;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Employee incidents — the operational record, and its optional consequence.
 *
 * Recording an incident never moves money. Where one justifies a deduction, the
 * deduction is RAISED from it and still needs approving like any other, and the
 * link between them is kept so the payslip line can be traced back to the event.
 */
final class IncidentService
{
    public function __construct(private readonly DeductionService $deductions) {}

    public function record(Employee $employee, array $data, ?int $actorId = null): EmployeeIncident
    {
        $category = ($data['category'] ?? null) instanceof IncidentCategory
            ? $data['category']
            : (IncidentCategory::tryFrom((string) ($data['category'] ?? '')) ?? IncidentCategory::OperationalNote);

        return EmployeeIncident::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'occurred_on' => $data['occurred_on'] ?? Carbon::now()->toDateString(),
            'category' => $category->value,
            'severity' => $data['severity'] ?? 'info',
            'description' => $data['description'],
            // Reference-only: the evidence stays in the module that owns it.
            'related_module' => $data['related_module'] ?? $category->typicalModule(),
            'related_reference' => $data['related_reference'] ?? null,
            'related_document_type' => $data['related_document_type'] ?? null,
            'amount' => isset($data['amount']) ? round((float) $data['amount'], 2) : null,
            'created_by' => $actorId,
        ]);
    }

    /**
     * Raise a deduction from an incident. The deduction starts pending — recording
     * that something happened is not the same as deciding someone should pay for it.
     */
    public function raiseDeduction(EmployeeIncident $incident, array $data, ?int $actorId = null): EmployeeIncident
    {
        if (! $incident->category->mayJustifyDeduction()) {
            return $incident;
        }

        return DB::transaction(function () use ($incident, $data, $actorId): EmployeeIncident {
            $type = match ($incident->category) {
                IncidentCategory::InventoryShortage => DeductionType::InventoryShortage,
                IncidentCategory::InventoryDamage => DeductionType::InventoryDamage,
                default => DeductionType::AdministrativePenalty,
            };

            $deduction = $this->deductions->raise($incident->employee, [
                'type' => $type->value,
                'amount' => $data['amount'] ?? $incident->amount,
                'reason' => $data['reason'] ?? $incident->description,
                'deduction_date' => $data['deduction_date'] ?? $incident->occurred_on?->toDateString(),
                'payroll_period_id' => $data['payroll_period_id'] ?? null,
                'source_module' => $incident->related_module,
                'source_reference' => $incident->related_reference,
                'notes' => 'Raised from incident '.$incident->id,
            ], $actorId);

            $incident->update(['deduction_id' => (string) $deduction->id]);

            return $incident->refresh();
        });
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, EmployeeIncident> */
    public function forEmployee(Employee $employee, int $months = 12)
    {
        return EmployeeIncident::query()
            ->where('employee_id', $employee->id)
            ->where('occurred_on', '>=', Carbon::now()->subMonthsNoOverflow($months)->toDateString())
            ->orderByDesc('occurred_on')
            ->get();
    }

    /** @return array<string, mixed> */
    public function summaryFor(Employee $employee, int $months = 12): array
    {
        $incidents = $this->forEmployee($employee, $months);

        return [
            'total' => $incidents->count(),
            'positive' => $incidents->filter(fn (EmployeeIncident $i) => $i->category->isPositive())->count(),
            'by_category' => $incidents->groupBy(fn (EmployeeIncident $i) => $i->category->value)
                ->map(fn ($group) => $group->count())->all(),
            'with_financial_outcome' => $incidents->filter(fn (EmployeeIncident $i) => $i->hasFinancialOutcome())->count(),
        ];
    }
}
