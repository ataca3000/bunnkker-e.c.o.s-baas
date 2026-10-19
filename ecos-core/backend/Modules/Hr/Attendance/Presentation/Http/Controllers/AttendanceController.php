<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Hr\Attendance\Domain\Enums\AttendanceStatus;
use Modules\Hr\Attendance\Domain\Models\AttendanceDay;
use Modules\Hr\Attendance\Domain\Services\AttendanceRegistrationService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Manual daily attendance registration. */
class AttendanceController extends Controller
{
    use ResolvesHrContext;

    public function __construct(private readonly AttendanceRegistrationService $attendance) {}

    /** The register sheet for a date — everyone, with what has been recorded so far. */
    public function sheet(Request $request): JsonResponse
    {
        $v = $request->validate([
            'date' => ['nullable', 'date'],
            'department_id' => ['nullable', 'string'],
        ]);

        $date = $v['date'] ?? Carbon::now()->toDateString();

        return response()->json([
            'data' => $this->attendance->sheet($this->companyId($request), $date, $v['department_id'] ?? null),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $v = $request->validate([
            'employee_id' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $from = $v['from'] ?? Carbon::now()->startOfMonth()->toDateString();
        $to = $v['to'] ?? Carbon::now()->toDateString();

        $rows = AttendanceDay::query()
            ->with('employee:id,first_name,last_name,employee_number')
            ->where('company_id', $this->companyId($request))
            ->when(isset($v['employee_id']), fn ($q) => $q->where('employee_id', $v['employee_id']))
            ->whereBetween('work_date', [$from, $to])
            ->orderByDesc('work_date')
            ->limit(500)->get()
            ->map(fn (AttendanceDay $d) => $this->payload($d));

        return response()->json(['data' => ['from' => $from, 'to' => $to, 'items' => $rows]]);
    }

    /** Record one person's day. */
    public function register(Request $request): JsonResponse
    {
        $v = $request->validate([
            'employee_id' => ['required', 'string'],
            'work_date' => ['required', 'date'],
            'status' => ['required', 'string'],
            'check_in' => ['nullable', 'date_format:H:i,H:i:s'],
            'check_out' => ['nullable', 'date_format:H:i,H:i:s'],
            'shift_id' => ['nullable', 'string'],
            'notes' => ['nullable', 'string', 'max:300'],
        ]);

        $status = AttendanceStatus::tryFrom($v['status']);
        if ($status === null) {
            return response()->json(['message' => 'Unknown attendance status.'], 422);
        }

        $day = $this->attendance->register(
            $this->employee($request, $v['employee_id']),
            $v['work_date'],
            $status,
            $v,
            $this->actorId($request),
        );

        return response()->json(['data' => $this->payload($day)], 201);
    }

    /** Record a whole team for one date in a single pass. */
    public function registerMany(Request $request): JsonResponse
    {
        $v = $request->validate([
            'work_date' => ['required', 'date'],
            'entries' => ['required', 'array', 'min:1', 'max:500'],
            'entries.*.employee_id' => ['required', 'string'],
            'entries.*.status' => ['required', 'string'],
            'entries.*.check_in' => ['nullable', 'date_format:H:i,H:i:s'],
            'entries.*.check_out' => ['nullable', 'date_format:H:i,H:i:s'],
            'entries.*.notes' => ['nullable', 'string', 'max:300'],
        ]);

        $result = $this->attendance->registerMany(
            $this->companyId($request), $v['work_date'], $v['entries'], $this->actorId($request)
        );

        return response()->json(['data' => $result]);
    }

    /** @return array<string, mixed> */
    private function payload(AttendanceDay $day): array
    {
        return [
            'id' => $day->id,
            'employee_id' => $day->employee_id,
            'employee' => $day->employee === null ? null : [
                'id' => $day->employee->id,
                'name' => $day->employee->fullName(),
                'employee_number' => $day->employee->employee_number,
            ],
            'department_id' => $day->department_id,
            'work_date' => $day->work_date?->toDateString(),
            'status' => $day->status->value,
            'status_label' => $day->status->label(),
            'check_in' => $day->check_in,
            'check_out' => $day->check_out,
            'source' => $day->source,
            'leave_request_id' => $day->leave_request_id,
            'notes' => $day->notes,
        ];
    }
}
