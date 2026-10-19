<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Services;

use Modules\Hr\Workforce\Domain\Models\EmploymentType;
use Modules\Hr\Workforce\Domain\Models\JobGrade;
use Modules\Hr\Workforce\Domain\Models\Position;

/**
 * Job grades, positions and employment types — the structural lookups an
 * administrator maintains. Grouped in one service because each is a small,
 * near-identical piece of administration and splitting them would be ceremony.
 */
final class WorkforceStructureService
{
    // ── Job grades ────────────────────────────────────────────────────────────

    public function createJobGrade(string $companyId, array $data): JobGrade
    {
        return JobGrade::create([
            'company_id' => $companyId,
            'code' => $data['code'],
            'name' => $data['name'],
            'level' => (int) ($data['level'] ?? 1),
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    public function updateJobGrade(JobGrade $grade, array $data): JobGrade
    {
        $grade->update(array_intersect_key($data, array_flip(['code', 'name', 'level', 'description', 'is_active'])));

        return $grade->refresh();
    }

    // ── Positions ─────────────────────────────────────────────────────────────

    public function createPosition(string $companyId, array $data): Position
    {
        return Position::create([
            'company_id' => $companyId,
            'department_id' => $data['department_id'] ?? null,
            'job_grade_id' => $data['job_grade_id'] ?? null,
            'code' => $data['code'],
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'headcount_limit' => $data['headcount_limit'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    public function updatePosition(Position $position, array $data): Position
    {
        $position->update(array_intersect_key($data, array_flip([
            'department_id', 'job_grade_id', 'code', 'title', 'description', 'headcount_limit', 'is_active',
        ])));

        return $position->refresh();
    }

    // ── Employment types ──────────────────────────────────────────────────────

    public function createEmploymentType(string $companyId, array $data): EmploymentType
    {
        return EmploymentType::create([
            'company_id' => $companyId,
            'code' => $data['code'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    public function updateEmploymentType(EmploymentType $type, array $data): EmploymentType
    {
        $type->update(array_intersect_key($data, array_flip(['code', 'name', 'description', 'is_active'])));

        return $type->refresh();
    }
}
