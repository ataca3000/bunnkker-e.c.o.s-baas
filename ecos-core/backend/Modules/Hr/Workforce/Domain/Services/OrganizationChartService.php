<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * The organisation chart, built from the current primary reporting lines.
 *
 * Two fixed queries regardless of how deep the organisation runs: everyone who is
 * employed, and every standing primary line. The tree is then assembled in
 * memory, which keeps a five-level hierarchy exactly as cheap as a two-level one.
 */
final class OrganizationChartService
{
    /** @return array<string, mixed> */
    public function build(string $companyId): array
    {
        $employees = Employee::query()
            ->where('company_id', $companyId)
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->with(['department:id,name', 'position:id,title'])
            ->orderBy('first_name')
            ->get();

        $lines = DB::table('hr_reporting_lines')
            ->where('company_id', $companyId)
            ->where('is_primary', true)
            ->whereNull('effective_to')
            ->pluck('manager_employee_id', 'employee_id');

        // Anyone without a standing manager is a root of the chart.
        $roots = $employees->filter(fn (Employee $e) => ! isset($lines[(string) $e->id]));

        return [
            'company_id' => $companyId,
            'employees' => $employees->count(),
            'roots' => $roots->values()->map(fn (Employee $e) => $this->node($e, $employees, $lines))->all(),
            'unassigned' => $employees->count() - $this->countNodes($roots, $employees, $lines),
        ];
    }

    /**
     * @param  Collection<int, Employee>  $all
     * @return array<string, mixed>
     */
    private function node(Employee $employee, Collection $all, Collection $lines, array $seen = []): array
    {
        $id = (string) $employee->id;
        $seen[] = $id;

        $reports = $all->filter(fn (Employee $e) => (string) ($lines[(string) $e->id] ?? '') === $id)
            // Defensive: a cycle should be impossible (ReportingLineService refuses
            // to create one), but the chart must never recurse forever if one exists.
            ->reject(fn (Employee $e) => in_array((string) $e->id, $seen, true));

        return [
            'id' => $employee->id,
            'employee_number' => $employee->employee_number,
            'name' => $employee->fullName(),
            'position' => $employee->position?->title,
            'department' => $employee->department?->name,
            'status' => $employee->status->value,
            'direct_reports' => $reports->count(),
            'children' => $reports->values()->map(fn (Employee $e) => $this->node($e, $all, $lines, $seen))->all(),
        ];
    }

    /** @param Collection<int, Employee> $roots */
    private function countNodes(Collection $roots, Collection $all, Collection $lines): int
    {
        $counted = [];
        $frontier = $roots->pluck('id')->map(fn ($id) => (string) $id)->all();

        while ($frontier !== []) {
            $counted = array_merge($counted, $frontier);
            $next = $all->filter(fn (Employee $e) => in_array((string) ($lines[(string) $e->id] ?? ''), $frontier, true))
                ->pluck('id')->map(fn ($id) => (string) $id)->all();
            $frontier = array_values(array_diff($next, $counted));
        }

        return count($counted);
    }
}
