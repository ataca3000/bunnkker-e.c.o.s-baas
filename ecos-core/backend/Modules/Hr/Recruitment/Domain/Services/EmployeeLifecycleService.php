<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Recruitment\Domain\Enums\LifecycleEventType;
use Modules\Hr\Recruitment\Domain\Models\EmployeeLifecycleEvent;
use Modules\Hr\Workforce\Domain\Enums\EmployeeStatus;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;

/**
 * Employment history — what happened to someone, and when.
 *
 * ┌─ THE LOG IS WRITTEN HERE · THE EMPLOYEE IS CHANGED BY H1 ───────────────┐
 * │ A transfer is two facts: the employee now sits somewhere else, and a        │
 * │ transfer happened on a date for a reason. H1 owns the first — this service  │
 * │ calls EmployeeService rather than touching `hr_employees` itself, so the    │
 * │ headcount and status rules it enforces still apply. This service owns the   │
 * │ second, and nothing else writes the history table.                          │
 * │                                                                            │
 * │ Every movement records what changed, before and after, so a reorganisation  │
 * │ two years ago is still readable — the employee row alone can never answer   │
 * │ that, because it only holds the latest values.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class EmployeeLifecycleService
{
    public function __construct(private readonly EmployeeService $employees) {}

    /** Write one history entry. The only writer of this table. */
    public function record(Employee $employee, LifecycleEventType $type, array $data = [], ?int $actorId = null): EmployeeLifecycleEvent
    {
        return EmployeeLifecycleEvent::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'event_type' => $type->value,
            'effective_date' => $data['effective_date'] ?? Carbon::now()->toDateString(),
            'reason' => $data['reason'] ?? null,
            'notes' => $data['notes'] ?? null,
            'from_values' => $data['from_values'] ?? null,
            'to_values' => $data['to_values'] ?? null,
            'source_module' => $data['source_module'] ?? null,
            'source_reference' => $data['source_reference'] ?? null,
            'actor_id' => $actorId,
        ]);
    }

    /**
     * Move someone to another department, recording what changed.
     *
     * The employee itself is moved by H1's transfer, which is where the vacancy
     * check lives; this adds the history entry around it.
     */
    public function transfer(Employee $employee, array $destination, ?string $reason = null, ?int $actorId = null): Employee
    {
        $before = $this->snapshot($employee);

        return DB::transaction(function () use ($employee, $destination, $reason, $actorId, $before): Employee {
            $moved = $this->employees->transfer($employee, $destination);
            $after = $this->snapshot($moved);

            $this->record($moved, $this->movementType($before, $after), [
                'effective_date' => $destination['effective_date'] ?? Carbon::now()->toDateString(),
                'reason' => $reason,
                'from_values' => $before,
                'to_values' => $after,
            ], $actorId);

            return $moved;
        });
    }

    /** A promotion is a position change that someone chose to call a promotion. */
    public function promote(Employee $employee, array $destination, ?string $reason = null, ?int $actorId = null): Employee
    {
        $before = $this->snapshot($employee);

        return DB::transaction(function () use ($employee, $destination, $reason, $actorId, $before): Employee {
            $moved = $this->employees->transfer($employee, $destination);

            $this->record($moved, LifecycleEventType::Promoted, [
                'effective_date' => $destination['effective_date'] ?? Carbon::now()->toDateString(),
                'reason' => $reason,
                'from_values' => $before,
                'to_values' => $this->snapshot($moved),
            ], $actorId);

            return $moved;
        });
    }

    /** Confirm someone off probation. */
    public function passProbation(Employee $employee, ?string $effectiveDate = null, ?int $actorId = null): Employee
    {
        return DB::transaction(function () use ($employee, $effectiveDate, $actorId): Employee {
            $before = ['status' => $employee->status->value];

            $confirmed = $employee->status === EmployeeStatus::Probation
                ? $this->employees->changeStatus($employee, EmployeeStatus::Active)
                : $employee;

            $this->record($confirmed, LifecycleEventType::ProbationPassed, [
                'effective_date' => $effectiveDate ?? Carbon::now()->toDateString(),
                'from_values' => $before,
                'to_values' => ['status' => $confirmed->status->value],
            ], $actorId);

            return $confirmed;
        });
    }

    /**
     * End someone's employment. H1 owns the terminal status; this records why and
     * when, which is the part an employment history has to keep.
     */
    public function separate(
        Employee $employee,
        string $reason,
        bool $resigned = false,
        ?string $effectiveDate = null,
        ?int $actorId = null,
    ): Employee {
        return DB::transaction(function () use ($employee, $reason, $resigned, $effectiveDate, $actorId): Employee {
            $before = $this->snapshot($employee);
            $date = $effectiveDate ?? Carbon::now()->toDateString();

            $separated = $this->employees->terminate($employee, $reason, $date, $resigned);

            $this->record($separated, $resigned ? LifecycleEventType::Resigned : LifecycleEventType::Terminated, [
                'effective_date' => $date,
                'reason' => $reason,
                'from_values' => $before,
                'to_values' => ['status' => $separated->status->value],
            ], $actorId);

            return $separated;
        });
    }

    /** Someone's full employment history, oldest first. */
    public function historyFor(Employee $employee)
    {
        return EmployeeLifecycleEvent::query()
            ->where('employee_id', $employee->id)
            ->orderBy('effective_date')
            ->orderBy('created_at')
            ->get();
    }

    /**
     * Company-wide movement over a window — what turnover analytics reads.
     *
     * @return array<string, mixed>
     */
    public function movementsBetween(string $companyId, string $from, string $to): array
    {
        $rows = DB::table('hr_employee_lifecycle_events')
            ->where('company_id', $companyId)
            ->whereBetween('effective_date', [$from, $to])
            ->groupBy('event_type')
            ->selectRaw('event_type, count(*) as total')
            ->pluck('total', 'event_type');

        $joiners = (int) ($rows[LifecycleEventType::Hired->value] ?? 0)
            + (int) ($rows[LifecycleEventType::Rehired->value] ?? 0);
        $leavers = (int) ($rows[LifecycleEventType::Resigned->value] ?? 0)
            + (int) ($rows[LifecycleEventType::Terminated->value] ?? 0);

        return [
            'from' => $from,
            'to' => $to,
            'joiners' => $joiners,
            'leavers' => $leavers,
            'net_change' => $joiners - $leavers,
            'resignations' => (int) ($rows[LifecycleEventType::Resigned->value] ?? 0),
            'terminations' => (int) ($rows[LifecycleEventType::Terminated->value] ?? 0),
            'transfers' => (int) ($rows[LifecycleEventType::Transferred->value] ?? 0),
            'promotions' => (int) ($rows[LifecycleEventType::Promoted->value] ?? 0),
            'by_type' => $rows->map(fn ($v) => (int) $v)->all(),
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function snapshot(Employee $employee): array
    {
        return [
            'department_id' => $employee->department_id === null ? null : (string) $employee->department_id,
            'position_id' => $employee->position_id === null ? null : (string) $employee->position_id,
            'branch_id' => $employee->branch_id === null ? null : (string) $employee->branch_id,
            'job_grade_id' => $employee->job_grade_id === null ? null : (string) $employee->job_grade_id,
            'status' => $employee->status->value,
        ];
    }

    /**
     * Name the movement for what actually changed: the department moving is a
     * transfer, the position moving is a position change.
     *
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    private function movementType(array $before, array $after): LifecycleEventType
    {
        if (($before['department_id'] ?? null) !== ($after['department_id'] ?? null)) {
            return LifecycleEventType::Transferred;
        }

        if (($before['position_id'] ?? null) !== ($after['position_id'] ?? null)) {
            return LifecycleEventType::PositionChanged;
        }

        return LifecycleEventType::Transferred;
    }
}
