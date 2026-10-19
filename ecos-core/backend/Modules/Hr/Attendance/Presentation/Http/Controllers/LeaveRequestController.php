<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Attendance\Domain\Models\LeaveRequest;
use Modules\Hr\Attendance\Domain\Services\LeaveRequestService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Leave requests and the manager decision on them. */
class LeaveRequestController extends Controller
{
    use ResolvesHrContext;

    public function __construct(private readonly LeaveRequestService $leave) {}

    public function index(Request $request): JsonResponse
    {
        $rows = LeaveRequest::query()
            ->with('employee:id,first_name,last_name,employee_number,department_id')
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('employee_id'), fn ($q) => $q->where('employee_id', $request->string('employee_id')))
            ->orderByDesc('start_date')
            ->limit(200)->get()
            ->map(fn (LeaveRequest $r) => $this->payload($r));

        return response()->json(['data' => $rows]);
    }

    public function pending(Request $request): JsonResponse
    {
        $rows = $this->leave->pending($this->companyId($request))->map(fn (LeaveRequest $r) => $this->payload($r));

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'employee_id' => ['required', 'string'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date'],
            'payroll_flag' => ['required', 'in:deduct_salary,do_not_deduct_salary'],
            'reason' => ['nullable', 'string', 'max:400'],
        ]);

        $leaveRequest = $this->leave->submit(
            $this->employee($request, $v['employee_id']), $v, $this->actorId($request)
        );

        return response()->json(['data' => $this->payload($leaveRequest)], 201);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['note' => ['nullable', 'string', 'max:400']]);

        $approved = $this->leave->approve(
            $this->leaveRequest($request, $id), $this->actingEmployee($request), $v['note'] ?? null
        );

        return response()->json(['data' => $this->payload($approved)]);
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['note' => ['nullable', 'string', 'max:400']]);

        $rejected = $this->leave->reject(
            $this->leaveRequest($request, $id), $this->actingEmployee($request), $v['note'] ?? null
        );

        return response()->json(['data' => $this->payload($rejected)]);
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['note' => ['nullable', 'string', 'max:400']]);

        return response()->json(['data' => $this->payload($this->leave->cancel($this->leaveRequest($request, $id), $v['note'] ?? null))]);
    }

    private function leaveRequest(Request $request, string $id): LeaveRequest
    {
        return LeaveRequest::query()
            ->where('company_id', $this->companyId($request))
            ->where('id', $id)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(LeaveRequest $request): array
    {
        return [
            'id' => $request->id,
            'request_number' => $request->request_number,
            'employee_id' => $request->employee_id,
            'employee' => $request->employee === null ? null : [
                'id' => $request->employee->id,
                'name' => $request->employee->fullName(),
                'employee_number' => $request->employee->employee_number,
                'department_id' => $request->employee->department_id,
            ],
            'start_date' => $request->start_date?->toDateString(),
            'end_date' => $request->end_date?->toDateString(),
            'days_count' => $request->days_count,
            'reason' => $request->reason,
            'payroll_flag' => $request->payroll_flag->value,
            'payroll_flag_label' => $request->payroll_flag->label(),
            'deducts_salary' => $request->deductsSalary(),
            'status' => $request->status->value,
            'status_label' => $request->status->label(),
            'decided_at' => $request->decided_at?->toDateTimeString(),
            'decision_note' => $request->decision_note,
        ];
    }
}
