<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\SalaryStructure;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * An employee's basic salary over time.
 *
 * A raise CLOSES the standing structure and opens a new one, so recalculating a
 * past period picks up the salary that was actually in force then rather than
 * today's number.
 */
final class SalaryStructureService
{
    public function assign(Employee $employee, float $basicSalary, array $data = [], ?int $actorId = null): SalaryStructure
    {
        if ($basicSalary <= 0) {
            throw CompensationException::amountMustBePositive();
        }

        $from = $data['effective_from'] ?? Carbon::now()->toDateString();

        return DB::transaction(function () use ($employee, $basicSalary, $data, $from, $actorId): SalaryStructure {
            // Close whatever stood before, the day before the new one starts.
            SalaryStructure::query()
                ->where('employee_id', $employee->id)
                ->whereNull('effective_to')
                ->update(['effective_to' => Carbon::parse($from)->subDay()->toDateString()]);

            return SalaryStructure::create([
                'company_id' => $employee->company_id,
                'employee_id' => $employee->id,
                'basic_salary' => round($basicSalary, 2),
                'currency' => $data['currency'] ?? 'EGP',
                'pay_frequency' => $data['pay_frequency'] ?? 'monthly',
                'effective_from' => $from,
                'notes' => $data['notes'] ?? null,
                'created_by' => $actorId,
            ]);
        });
    }

    /** The structure in force on a date — what a calculation for that date must use. */
    public function inForceOn(Employee $employee, string $date): ?SalaryStructure
    {
        return SalaryStructure::query()
            ->where('employee_id', $employee->id)
            ->inForceOn($date)
            ->orderByDesc('effective_from')
            ->first();
    }

    public function current(Employee $employee): ?SalaryStructure
    {
        return $this->inForceOn($employee, Carbon::now()->toDateString());
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, SalaryStructure> */
    public function history(Employee $employee)
    {
        return SalaryStructure::query()
            ->where('employee_id', $employee->id)
            ->orderByDesc('effective_from')
            ->get();
    }
}
