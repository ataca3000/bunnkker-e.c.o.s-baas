<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Attendance\Domain\Enums\AttendanceStatus;
use Modules\Hr\Attendance\Domain\Enums\LeavePayrollFlag;
use Modules\Hr\Attendance\Domain\Enums\LeaveStatus;
use Modules\Hr\Attendance\Domain\Exceptions\AttendanceException;
use Modules\Hr\Attendance\Domain\Models\AttendanceDay;
use Modules\Hr\Attendance\Domain\Models\LeaveRequest;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Leave requests and manager approval.
 *
 * ┌─ REQUEST · DECIDE · WRITE IT ONTO THE ATTENDANCE RECORD ────────────────┐
 * │ Approving a request is what makes it real: the covered days are written as  │
 * │ leave onto the attendance record, so the availability dashboard reflects    │
 * │ the decision immediately and nobody has to register those days by hand.     │
 * │ Cancelling an approved request removes exactly the days it wrote.           │
 * │                                                                            │
 * │ `payroll_flag` travels with the request and is the only thing Payroll needs │
 * │ from it. There are no balances to draw down, no leave types to choose from  │
 * │ and no entitlement policy to evaluate — this epic does not answer those.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class LeaveRequestService
{
    public function __construct(private readonly HolidayService $holidays) {}

    public function submit(Employee $employee, array $data, ?int $actorId = null): LeaveRequest
    {
        $start = Carbon::parse($data['start_date'])->startOfDay();
        $end = Carbon::parse($data['end_date'] ?? $data['start_date'])->startOfDay();

        if ($end->lessThan($start)) {
            throw AttendanceException::leaveEndsBeforeItStarts();
        }

        $this->assertNoOverlap($employee, $start, $end);

        $flag = ($data['payroll_flag'] ?? null) instanceof LeavePayrollFlag
            ? $data['payroll_flag']
            : (LeavePayrollFlag::tryFrom((string) ($data['payroll_flag'] ?? '')) ?? LeavePayrollFlag::DeductSalary);

        return LeaveRequest::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'request_number' => $this->nextRequestNumber((string) $employee->company_id),
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            // An inclusive count of the days requested — a record of what was
            // asked for, not an entitlement calculation.
            'days_count' => (int) floor((float) $start->diffInDays($end)) + 1,
            'reason' => $data['reason'] ?? null,
            'payroll_flag' => $flag->value,
            'status' => LeaveStatus::Pending->value,
            'requested_by' => $actorId,
        ]);
    }

    /** Approve, and write the covered days onto the attendance record. */
    public function approve(LeaveRequest $request, ?Employee $decidedBy = null, ?string $note = null): LeaveRequest
    {
        $this->assertTransition($request, LeaveStatus::Approved);

        return DB::transaction(function () use ($request, $decidedBy, $note): LeaveRequest {
            $request->update([
                'status' => LeaveStatus::Approved->value,
                'decided_by_employee_id' => $decidedBy?->id,
                'decided_at' => Carbon::now(),
                'decision_note' => $note,
            ]);

            $this->writeLeaveDays($request->refresh());

            return $request->refresh();
        });
    }

    public function reject(LeaveRequest $request, ?Employee $decidedBy = null, ?string $note = null): LeaveRequest
    {
        $this->assertTransition($request, LeaveStatus::Rejected);

        $request->update([
            'status' => LeaveStatus::Rejected->value,
            'decided_by_employee_id' => $decidedBy?->id,
            'decided_at' => Carbon::now(),
            'decision_note' => $note,
        ]);

        return $request->refresh();
    }

    /** Cancel — and take back exactly the attendance days this request wrote. */
    public function cancel(LeaveRequest $request, ?string $note = null): LeaveRequest
    {
        $this->assertTransition($request, LeaveStatus::Cancelled);

        return DB::transaction(function () use ($request, $note): LeaveRequest {
            AttendanceDay::query()->where('leave_request_id', $request->id)->delete();

            $request->update([
                'status' => LeaveStatus::Cancelled->value,
                'decision_note' => $note ?? $request->decision_note,
            ]);

            return $request->refresh();
        });
    }

    /** Requests waiting on a decision. @return \Illuminate\Database\Eloquent\Collection<int, LeaveRequest> */
    public function pending(string $companyId)
    {
        return LeaveRequest::query()
            ->with('employee:id,first_name,last_name,employee_number,department_id')
            ->where('company_id', $companyId)
            ->where('status', LeaveStatus::Pending->value)
            ->orderBy('start_date')
            ->get();
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * Mark every covered day as leave, except days that are already an official
     * holiday — nobody spends leave on a day the company was closed anyway.
     */
    private function writeLeaveDays(LeaveRequest $request): void
    {
        $employee = $request->employee;
        $cursor = $request->start_date->copy();

        while ($cursor->lessThanOrEqualTo($request->end_date)) {
            if ($this->holidays->isHoliday((string) $request->company_id, $cursor)) {
                $cursor->addDay();

                continue;
            }

            AttendanceDay::updateOrCreate(
                ['employee_id' => $request->employee_id, 'work_date' => $cursor->toDateString()],
                [
                    'company_id' => $request->company_id,
                    'department_id' => $employee?->department_id,
                    'status' => AttendanceStatus::Leave->value,
                    'source' => 'manual',
                    'leave_request_id' => $request->id,
                    'notes' => 'Approved leave '.$request->request_number,
                ]
            );

            $cursor->addDay();
        }
    }

    private function assertNoOverlap(Employee $employee, Carbon $start, Carbon $end): void
    {
        $overlaps = LeaveRequest::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', [LeaveStatus::Pending->value, LeaveStatus::Approved->value])
            ->where('start_date', '<=', $end->toDateString())
            ->where('end_date', '>=', $start->toDateString())
            ->exists();

        if ($overlaps) {
            throw AttendanceException::overlappingLeave();
        }
    }

    private function assertTransition(LeaveRequest $request, LeaveStatus $target): void
    {
        if (! $request->status->canTransitionTo($target)) {
            throw AttendanceException::invalidLeaveTransition($request->status->value, $target->value);
        }
    }

    private function nextRequestNumber(string $companyId): string
    {
        $last = LeaveRequest::query()
            ->where('company_id', $companyId)
            ->where('request_number', 'like', 'LV-%')
            ->orderByDesc('request_number')
            ->value('request_number');

        $next = $last === null ? 1 : ((int) substr((string) $last, 3)) + 1;

        return 'LV-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
