<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Workforce\Domain\Enums\EmployeeStatus;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\Employee360Service;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** The employee master and the Employee 360 workspace. */
class EmployeeController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly EmployeeService $employees,
        private readonly Employee360Service $employee360,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(5, (int) $request->integer('per_page', 25)));

        $query = Employee::query()
            ->with(['department:id,name', 'position:id,title', 'jobGrade:id,name', 'employmentType:id,name'])
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('search'), function ($q) use ($request): void {
                $term = '%'.$request->string('search')->toString().'%';
                $q->where(function ($inner) use ($term): void {
                    $inner->where('first_name', 'like', $term)
                        ->orWhere('last_name', 'like', $term)
                        ->orWhere('employee_number', 'like', $term)
                        ->orWhere('work_email', 'like', $term);
                });
            })
            ->when($request->filled('department_id'), fn ($q) => $q->where('department_id', $request->string('department_id')))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->string('branch_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderBy('first_name');

        $page = $query->paginate($perPage);

        return response()->json([
            'data' => [
                'items' => collect($page->items())->map(fn (Employee $e) => $this->payload($e))->all(),
                'meta' => [
                    'current_page' => $page->currentPage(),
                    'per_page' => $page->perPage(),
                    'total' => $page->total(),
                    'last_page' => $page->lastPage(),
                ],
            ],
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->employee($request, $id))]);
    }

    /** The Employee 360 workspace payload. */
    public function overview(Request $request, string $id): JsonResponse
    {
        $employee = $this->employee($request, $id);

        return response()->json(['data' => $this->employee360->build($employee)]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate($this->rules());

        $employee = $this->employees->create($this->companyId($request), $v, $this->actorId($request));

        return response()->json(['data' => $this->payload($employee)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $v = $request->validate($this->rules(updating: true));
        $employee = $this->employees->update($this->employee($request, $id), $v);

        return response()->json(['data' => $this->payload($employee)]);
    }

    public function transfer(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'department_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'position_id' => ['nullable', 'string'],
            'job_grade_id' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->payload($this->employees->transfer($this->employee($request, $id), $v))]);
    }

    public function changeStatus(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['status' => ['required', 'string']]);
        $target = EmployeeStatus::tryFrom($v['status']);

        if ($target === null) {
            return response()->json(['message' => 'Unknown employee status.'], 422);
        }

        return response()->json(['data' => $this->payload($this->employees->changeStatus($this->employee($request, $id), $target))]);
    }

    public function terminate(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'reason' => ['required', 'string', 'max:250'],
            'termination_date' => ['nullable', 'date'],
            'resigned' => ['nullable', 'boolean'],
        ]);

        $employee = $this->employee($request, $id);

        // Nobody ends their own employment.
        if (! app(\Modules\Hr\Workforce\Domain\Policies\EmployeePolicy::class)->terminate($request->user(), $employee)) {
            return response()->json(['message' => 'You cannot terminate your own employment.'], 403);
        }

        $employee = $this->employees->terminate(
            $employee, $v['reason'], $v['termination_date'] ?? null, (bool) ($v['resigned'] ?? false)
        );

        return response()->json(['data' => $this->payload($employee)]);
    }

    public function nextNumber(Request $request): JsonResponse
    {
        return response()->json(['data' => ['employee_number' => $this->employees->nextEmployeeNumber($this->companyId($request))]]);
    }

    /** @return array<string, mixed> */
    private function rules(bool $updating = false): array
    {
        $required = $updating ? 'sometimes' : 'required';

        return [
            'first_name' => [$required, 'string', 'max:100'],
            'last_name' => [$required, 'string', 'max:100'],
            'employee_number' => ['nullable', 'string', 'max:30'],
            'display_name' => ['nullable', 'string', 'max:200'],
            'branch_id' => ['nullable', 'string'],
            'department_id' => ['nullable', 'string'],
            'position_id' => ['nullable', 'string'],
            'job_grade_id' => ['nullable', 'string'],
            'employment_type_id' => ['nullable', 'string'],
            'user_id' => ['nullable', 'integer'],
            'national_id' => ['nullable', 'string', 'max:40'],
            'gender' => ['nullable', 'string', 'max:12'],
            'date_of_birth' => ['nullable', 'date'],
            'work_email' => ['nullable', 'email', 'max:150'],
            'personal_email' => ['nullable', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'mobile' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:250'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'emergency_contact_name' => ['nullable', 'string', 'max:150'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:30'],
            'hire_date' => ['nullable', 'date'],
            'status' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ];
    }

    /** @return array<string, mixed> */
    private function payload(Employee $employee): array
    {
        return [
            'id' => $employee->id,
            'employee_number' => $employee->employee_number,
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'name' => $employee->fullName(),
            'status' => $employee->status->value,
            'status_label' => $employee->status->label(),
            'work_email' => $employee->work_email,
            'mobile' => $employee->mobile,
            'branch_id' => $employee->branch_id,
            'department_id' => $employee->department_id,
            'department' => $employee->department?->only(['id', 'name']),
            'position_id' => $employee->position_id,
            'position' => $employee->position?->only(['id', 'title']),
            'job_grade' => $employee->jobGrade?->only(['id', 'name']),
            'employment_type' => $employee->employmentType?->only(['id', 'name']),
            'hire_date' => $employee->hire_date?->toDateString(),
            'termination_date' => $employee->termination_date?->toDateString(),
            'user_id' => $employee->user_id,
        ];
    }
}
