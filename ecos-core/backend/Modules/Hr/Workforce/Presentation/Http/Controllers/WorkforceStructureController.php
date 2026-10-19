<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Workforce\Domain\Models\Department;
use Modules\Hr\Workforce\Domain\Models\EmploymentType;
use Modules\Hr\Workforce\Domain\Models\JobGrade;
use Modules\Hr\Workforce\Domain\Models\Position;
use Modules\Hr\Workforce\Domain\Services\DepartmentService;
use Modules\Hr\Workforce\Domain\Services\WorkforceStructureService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Departments, positions, job grades and employment types. */
class WorkforceStructureController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly DepartmentService $departments,
        private readonly WorkforceStructureService $structure,
    ) {}

    // ── Departments ───────────────────────────────────────────────────────────

    public function departments(Request $request): JsonResponse
    {
        $rows = Department::query()
            ->where('company_id', $this->companyId($request))
            ->withCount('employees')
            ->orderBy('name')->get()
            ->map(fn (Department $d) => [
                'id' => $d->id,
                'code' => $d->code,
                'name' => $d->name,
                'parent_id' => $d->parent_id,
                'branch_id' => $d->branch_id,
                'manager_employee_id' => $d->manager_employee_id,
                'description' => $d->description,
                'is_active' => $d->is_active,
                'employees_count' => (int) ($d->employees_count ?? 0),
            ]);

        return response()->json(['data' => $rows]);
    }

    public function departmentTree(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->departments->tree($this->companyId($request))]);
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        $v = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:150'],
            'parent_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'manager_employee_id' => ['nullable', 'string'],
            'description' => ['nullable', 'string', 'max:300'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->departments->create($this->companyId($request), $v)], 201);
    }

    public function updateDepartment(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'code' => ['sometimes', 'string', 'max:30'],
            'name' => ['sometimes', 'string', 'max:150'],
            'parent_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'manager_employee_id' => ['nullable', 'string'],
            'description' => ['nullable', 'string', 'max:300'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $department = $this->scoped(Department::class, $request, $id);

        return response()->json(['data' => $this->departments->update($department, $v)]);
    }

    // ── Positions ─────────────────────────────────────────────────────────────

    public function positions(Request $request): JsonResponse
    {
        $rows = Position::query()
            ->with(['department:id,name', 'jobGrade:id,name'])
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('department_id'), fn ($q) => $q->where('department_id', $request->string('department_id')))
            ->orderBy('title')->get()
            ->map(fn (Position $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'title' => $p->title,
                'department_id' => $p->department_id,
                'department' => $p->department?->only(['id', 'name']),
                'job_grade_id' => $p->job_grade_id,
                'job_grade' => $p->jobGrade?->only(['id', 'name']),
                'headcount_limit' => $p->headcount_limit,
                'filled_headcount' => $p->filledHeadcount(),
                'has_vacancy' => $p->hasVacancy(),
                'is_active' => $p->is_active,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function storePosition(Request $request): JsonResponse
    {
        $v = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'title' => ['required', 'string', 'max:150'],
            'department_id' => ['nullable', 'string'],
            'job_grade_id' => ['nullable', 'string'],
            'description' => ['nullable', 'string', 'max:300'],
            'headcount_limit' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->structure->createPosition($this->companyId($request), $v)], 201);
    }

    public function updatePosition(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'code' => ['sometimes', 'string', 'max:30'],
            'title' => ['sometimes', 'string', 'max:150'],
            'department_id' => ['nullable', 'string'],
            'job_grade_id' => ['nullable', 'string'],
            'description' => ['nullable', 'string', 'max:300'],
            'headcount_limit' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->structure->updatePosition($this->scoped(Position::class, $request, $id), $v)]);
    }

    // ── Job grades ────────────────────────────────────────────────────────────

    public function jobGrades(Request $request): JsonResponse
    {
        $rows = JobGrade::query()
            ->where('company_id', $this->companyId($request))
            ->orderBy('level')->get();

        return response()->json(['data' => $rows]);
    }

    public function storeJobGrade(Request $request): JsonResponse
    {
        $v = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:120'],
            'level' => ['nullable', 'integer', 'min:1', 'max:999'],
            'description' => ['nullable', 'string', 'max:300'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->structure->createJobGrade($this->companyId($request), $v)], 201);
    }

    public function updateJobGrade(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'code' => ['sometimes', 'string', 'max:30'],
            'name' => ['sometimes', 'string', 'max:120'],
            'level' => ['nullable', 'integer', 'min:1', 'max:999'],
            'description' => ['nullable', 'string', 'max:300'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->structure->updateJobGrade($this->scoped(JobGrade::class, $request, $id), $v)]);
    }

    // ── Employment types ──────────────────────────────────────────────────────

    public function employmentTypes(Request $request): JsonResponse
    {
        $rows = EmploymentType::query()
            ->where('company_id', $this->companyId($request))
            ->orderBy('name')->get();

        return response()->json(['data' => $rows]);
    }

    public function storeEmploymentType(Request $request): JsonResponse
    {
        $v = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:300'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->structure->createEmploymentType($this->companyId($request), $v)], 201);
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  class-string<TModel>  $model
     * @return TModel
     */
    private function scoped(string $model, Request $request, string $id)
    {
        return $model::query()
            ->where('company_id', $this->companyId($request))
            ->where('id', $id)
            ->firstOrFail();
    }
}
