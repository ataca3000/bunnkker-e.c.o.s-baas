<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Workforce\Domain\Enums\ReportingLineType;
use Modules\Hr\Workforce\Domain\Exceptions\WorkforceException;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Models\ReportingLine;

/**
 * Who reports to whom.
 *
 * ┌─ THE CHAIN MUST STAY A CHAIN ───────────────────────────────────────────┐
 * │ Assigning a manager walks the existing chain upward first: if the proposed  │
 * │ manager already reports to this employee, directly or several levels up,    │
 * │ the assignment is refused. A cycle here would hang the organisation chart   │
 * │ and every approval walk that follows a reporting line.                      │
 * │                                                                            │
 * │ Reassigning does not overwrite. The previous primary line is closed with an │
 * │ effective_to date and a new one opens, so a reorganisation reads as history.│
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ReportingLineService
{
    public function assignManager(
        Employee $employee,
        Employee $manager,
        ReportingLineType $type = ReportingLineType::Primary,
        ?string $effectiveFrom = null,
        ?string $note = null,
    ): ReportingLine {
        if ((string) $employee->id === (string) $manager->id) {
            throw WorkforceException::cannotManageSelf();
        }

        if ((string) $employee->company_id !== (string) $manager->company_id) {
            throw WorkforceException::crossCompany();
        }

        $this->assertNoCycle($employee, $manager);

        $isPrimary = $type->buildsOrgChart();
        $from = $effectiveFrom ?? Carbon::now()->toDateString();

        return DB::transaction(function () use ($employee, $manager, $type, $isPrimary, $from, $note): ReportingLine {
            if ($isPrimary) {
                // Close the standing primary line rather than deleting it.
                ReportingLine::query()
                    ->where('employee_id', $employee->id)
                    ->where('is_primary', true)
                    ->whereNull('effective_to')
                    ->update(['effective_to' => $from]);
            }

            return ReportingLine::create([
                'company_id' => $employee->company_id,
                'employee_id' => $employee->id,
                'manager_employee_id' => $manager->id,
                'type' => $type->value,
                'is_primary' => $isPrimary,
                'effective_from' => $from,
                'note' => $note,
            ]);
        });
    }

    /** Close a reporting line without opening a replacement. */
    public function end(ReportingLine $line, ?string $effectiveTo = null): ReportingLine
    {
        $line->update(['effective_to' => $effectiveTo ?? Carbon::now()->toDateString()]);

        return $line->refresh();
    }

    public function currentManager(Employee $employee): ?Employee
    {
        $line = ReportingLine::query()
            ->with('manager')
            ->where('employee_id', $employee->id)
            ->primary()->current()
            ->latest('effective_from')
            ->first();

        return $line?->manager;
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, Employee> */
    public function directReports(Employee $manager)
    {
        $ids = ReportingLine::query()
            ->where('manager_employee_id', $manager->id)
            ->primary()->current()
            ->pluck('employee_id');

        return Employee::query()->whereIn('id', $ids)->orderBy('first_name')->get();
    }

    /**
     * The management chain above an employee, nearest first.
     *
     * @return array<int, Employee>
     */
    public function managementChain(Employee $employee, int $maxDepth = 20): array
    {
        $chain = [];
        $seen = [(string) $employee->id];
        $current = $employee;

        for ($i = 0; $i < $maxDepth; $i++) {
            $manager = $this->currentManager($current);
            if ($manager === null || in_array((string) $manager->id, $seen, true)) {
                break;
            }

            $chain[] = $manager;
            $seen[] = (string) $manager->id;
            $current = $manager;
        }

        return $chain;
    }

    private function assertNoCycle(Employee $employee, Employee $proposedManager): void
    {
        foreach ($this->managementChain($proposedManager) as $ancestor) {
            if ((string) $ancestor->id === (string) $employee->id) {
                throw WorkforceException::reportingCycle();
            }
        }
    }
}
