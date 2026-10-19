<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Workforce\Domain\Models\EmploymentContract;
use Modules\Hr\Workforce\Domain\Services\EmploymentContractService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Employment contracts — issue, activate, terminate, and watch for expiry. */
class EmploymentContractController extends Controller
{
    use ResolvesHrContext;

    public function __construct(private readonly EmploymentContractService $contracts) {}

    public function index(Request $request): JsonResponse
    {
        $rows = EmploymentContract::query()
            ->with('employee:id,first_name,last_name,employee_number')
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('employee_id'), fn ($q) => $q->where('employee_id', $request->string('employee_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('start_date')
            ->limit(200)->get()
            ->map(fn (EmploymentContract $c) => $this->payload($c));

        return response()->json(['data' => $rows]);
    }

    public function expiring(Request $request): JsonResponse
    {
        $days = min(365, max(1, (int) $request->integer('days', 30)));
        $rows = $this->contracts->expiringWithin($this->companyId($request), $days)
            ->map(fn (EmploymentContract $c) => $this->payload($c));

        return response()->json(['data' => ['days' => $days, 'items' => $rows]]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'employee_id' => ['required', 'string'],
            'type' => ['required', 'string'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date'],
            'probation_end_date' => ['nullable', 'date'],
            'position_id' => ['nullable', 'string'],
            'job_grade_id' => ['nullable', 'string'],
            'employment_type_id' => ['nullable', 'string'],
            'weekly_hours' => ['nullable', 'numeric', 'min:0', 'max:168'],
            'notes' => ['nullable', 'string'],
        ]);

        $employee = $this->employee($request, $v['employee_id']);
        $contract = $this->contracts->issue($this->companyId($request), $employee, $v, $this->actorId($request));

        return response()->json(['data' => $this->payload($contract)], 201);
    }

    public function activate(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->contracts->activate($this->contract($request, $id)))]);
    }

    public function terminate(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['reason' => ['required', 'string', 'max:250']]);

        return response()->json(['data' => $this->payload($this->contracts->terminate($this->contract($request, $id), $v['reason']))]);
    }

    public function expire(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->contracts->expire($this->contract($request, $id)))]);
    }

    private function contract(Request $request, string $id): EmploymentContract
    {
        return EmploymentContract::query()
            ->where('company_id', $this->companyId($request))
            ->where('id', $id)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(EmploymentContract $contract): array
    {
        return [
            'id' => $contract->id,
            'contract_number' => $contract->contract_number,
            'employee_id' => $contract->employee_id,
            'employee' => $contract->employee === null ? null : [
                'id' => $contract->employee->id,
                'name' => $contract->employee->fullName(),
                'employee_number' => $contract->employee->employee_number,
            ],
            'type' => $contract->type->value,
            'type_label' => $contract->type->label(),
            'status' => $contract->status->value,
            'start_date' => $contract->start_date?->toDateString(),
            'end_date' => $contract->end_date?->toDateString(),
            'probation_end_date' => $contract->probation_end_date?->toDateString(),
            'weekly_hours' => $contract->weekly_hours,
            'days_until_expiry' => $contract->daysUntilExpiry(),
            'notes' => $contract->notes,
        ];
    }
}
