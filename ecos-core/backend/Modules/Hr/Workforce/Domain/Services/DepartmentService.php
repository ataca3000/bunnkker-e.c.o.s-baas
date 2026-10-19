<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Services;

use Illuminate\Support\Collection;
use Modules\Hr\Workforce\Domain\Exceptions\WorkforceException;
use Modules\Hr\Workforce\Domain\Models\Department;

/**
 * Departments and the structural tree they form.
 *
 * The one rule worth enforcing here is that the tree stays a tree: re-parenting a
 * department under one of its own descendants would create a cycle that every
 * later walk — the chart, the headcount roll-up — would loop on forever.
 */
final class DepartmentService
{
    public function create(string $companyId, array $data): Department
    {
        if (! empty($data['parent_id'])) {
            $this->assertSameCompany($companyId, (string) $data['parent_id']);
        }

        return Department::create([
            'company_id' => $companyId,
            'branch_id' => $data['branch_id'] ?? null,
            'parent_id' => $data['parent_id'] ?? null,
            'manager_employee_id' => $data['manager_employee_id'] ?? null,
            'code' => $data['code'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    public function update(Department $department, array $data): Department
    {
        if (array_key_exists('parent_id', $data) && $data['parent_id'] !== null) {
            $this->assertSameCompany((string) $department->company_id, (string) $data['parent_id']);
            $this->assertNoCycle($department, (string) $data['parent_id']);
        }

        $department->update(array_intersect_key($data, array_flip([
            'branch_id', 'parent_id', 'manager_employee_id', 'code', 'name', 'description', 'is_active',
        ])));

        return $department->refresh();
    }

    /**
     * The department tree, nested. One query, assembled in memory — the tree is
     * small and this avoids a query per level.
     *
     * @return array<int, array<string, mixed>>
     */
    public function tree(string $companyId): array
    {
        $departments = Department::query()
            ->where('company_id', $companyId)
            ->withCount('employees')
            ->orderBy('name')
            ->get();

        return $this->nest($departments, null);
    }

    /** Every descendant id of a department, including itself. @return array<int, string> */
    public function subtreeIds(Department $department): array
    {
        $all = Department::query()
            ->where('company_id', $department->company_id)
            ->get(['id', 'parent_id']);

        $ids = [(string) $department->id];
        $frontier = [(string) $department->id];

        while ($frontier !== []) {
            $children = $all->whereIn('parent_id', $frontier)->pluck('id')->map(fn ($id) => (string) $id)->all();
            $children = array_values(array_diff($children, $ids));   // cycle-safe
            if ($children === []) {
                break;
            }

            $ids = array_merge($ids, $children);
            $frontier = $children;
        }

        return $ids;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * @param  Collection<int, Department>  $all
     * @return array<int, array<string, mixed>>
     */
    private function nest(Collection $all, ?string $parentId): array
    {
        return $all
            ->filter(fn (Department $d) => (string) ($d->parent_id ?? '') === (string) ($parentId ?? ''))
            ->values()
            ->map(fn (Department $d) => [
                'id' => $d->id,
                'code' => $d->code,
                'name' => $d->name,
                'branch_id' => $d->branch_id,
                'manager_employee_id' => $d->manager_employee_id,
                'is_active' => $d->is_active,
                'employees_count' => (int) ($d->employees_count ?? 0),
                'children' => $this->nest($all, (string) $d->id),
            ])->all();
    }

    private function assertNoCycle(Department $department, string $newParentId): void
    {
        if ($newParentId === (string) $department->id) {
            throw WorkforceException::departmentCycle();
        }

        if (in_array($newParentId, $this->subtreeIds($department), true)) {
            throw WorkforceException::departmentCycle();
        }
    }

    private function assertSameCompany(string $companyId, string $departmentId): void
    {
        $exists = Department::query()->where('id', $departmentId)->where('company_id', $companyId)->exists();

        if (! $exists) {
            throw WorkforceException::crossCompany();
        }
    }
}
