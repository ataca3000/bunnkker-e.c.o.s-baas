<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Attendance\Domain\Models\EmployeeShiftAssignment;
use Modules\Hr\Attendance\Domain\Models\Shift;
use Modules\Hr\Attendance\Domain\Models\WorkCalendar;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** Work calendars, shifts, and which shift an employee is currently on. */
final class WorkScheduleService
{
    // ── Calendars ─────────────────────────────────────────────────────────────

    public function createCalendar(string $companyId, array $data): WorkCalendar
    {
        return DB::transaction(function () use ($companyId, $data): WorkCalendar {
            $isDefault = (bool) ($data['is_default'] ?? false);

            if ($isDefault) {
                WorkCalendar::query()->where('company_id', $companyId)->update(['is_default' => false]);
            }

            return WorkCalendar::create([
                'company_id' => $companyId,
                'code' => $data['code'],
                'name' => $data['name'],
                'working_days' => array_map('intval', (array) ($data['working_days'] ?? [7, 1, 2, 3, 4])),
                'default_start_time' => $data['default_start_time'] ?? null,
                'default_end_time' => $data['default_end_time'] ?? null,
                'is_default' => $isDefault,
                'is_active' => $data['is_active'] ?? true,
            ]);
        });
    }

    public function updateCalendar(WorkCalendar $calendar, array $data): WorkCalendar
    {
        return DB::transaction(function () use ($calendar, $data): WorkCalendar {
            if (! empty($data['is_default'])) {
                WorkCalendar::query()
                    ->where('company_id', $calendar->company_id)
                    ->where('id', '!=', $calendar->id)
                    ->update(['is_default' => false]);
            }

            if (isset($data['working_days'])) {
                $data['working_days'] = array_map('intval', (array) $data['working_days']);
            }

            $calendar->update(array_intersect_key($data, array_flip([
                'code', 'name', 'working_days', 'default_start_time', 'default_end_time', 'is_default', 'is_active',
            ])));

            return $calendar->refresh();
        });
    }

    public function defaultCalendar(string $companyId): ?WorkCalendar
    {
        return WorkCalendar::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->first();
    }

    /** Is this a working weekday under the company's calendar? */
    public function isWorkingDay(string $companyId, Carbon $date): bool
    {
        $calendar = $this->defaultCalendar($companyId);

        // With no calendar configured, every day is treated as workable rather
        // than silently marking the whole workforce as resting.
        return $calendar === null || $calendar->isWorkingDay($date);
    }

    // ── Shifts ────────────────────────────────────────────────────────────────

    public function createShift(string $companyId, array $data): Shift
    {
        return Shift::create([
            'company_id' => $companyId,
            'work_calendar_id' => $data['work_calendar_id'] ?? null,
            'code' => $data['code'],
            'name' => $data['name'],
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'break_minutes' => (int) ($data['break_minutes'] ?? 0),
            'crosses_midnight' => $data['crosses_midnight'] ?? false,
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    public function updateShift(Shift $shift, array $data): Shift
    {
        $shift->update(array_intersect_key($data, array_flip([
            'work_calendar_id', 'code', 'name', 'start_time', 'end_time',
            'break_minutes', 'crosses_midnight', 'is_active',
        ])));

        return $shift->refresh();
    }

    /** Put an employee on a shift, closing whatever assignment stood before. */
    public function assignShift(Employee $employee, Shift $shift, ?string $effectiveFrom = null): EmployeeShiftAssignment
    {
        $from = $effectiveFrom ?? Carbon::now()->toDateString();

        return DB::transaction(function () use ($employee, $shift, $from): EmployeeShiftAssignment {
            EmployeeShiftAssignment::query()
                ->where('employee_id', $employee->id)
                ->whereNull('effective_to')
                ->update(['effective_to' => $from]);

            return EmployeeShiftAssignment::create([
                'company_id' => $employee->company_id,
                'employee_id' => $employee->id,
                'shift_id' => $shift->id,
                'effective_from' => $from,
            ]);
        });
    }

    public function currentShift(Employee $employee): ?Shift
    {
        return EmployeeShiftAssignment::query()
            ->with('shift')
            ->where('employee_id', $employee->id)
            ->current()
            ->latest('effective_from')
            ->first()?->shift;
    }
}
