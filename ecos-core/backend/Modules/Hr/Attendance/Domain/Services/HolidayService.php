<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Attendance\Domain\Enums\HolidayType;
use Modules\Hr\Attendance\Domain\Models\OfficialHoliday;

/**
 * Official holidays.
 *
 * Eid Al-Fitr and Eid Al-Adha follow the lunar calendar, so their Gregorian dates
 * shift by roughly eleven days each year and cannot be computed from a rule. They
 * are recorded per occurrence and maintained by HR, which is why a holiday here is
 * a dated range rather than a recurrence pattern.
 */
final class HolidayService
{
    public function create(string $companyId, array $data): OfficialHoliday
    {
        $start = Carbon::parse($data['start_date']);
        $end = isset($data['end_date']) && $data['end_date'] !== null ? Carbon::parse($data['end_date']) : $start->copy();

        if ($end->lessThan($start)) {
            $end = $start->copy();
        }

        $type = ($data['type'] ?? null) instanceof HolidayType
            ? $data['type']
            : (HolidayType::tryFrom((string) ($data['type'] ?? '')) ?? HolidayType::Public);

        return OfficialHoliday::create([
            'company_id' => $companyId,
            'name' => $data['name'],
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'type' => $type->value,
            'notes' => $data['notes'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    public function update(OfficialHoliday $holiday, array $data): OfficialHoliday
    {
        $holiday->update(array_intersect_key($data, array_flip([
            'name', 'start_date', 'end_date', 'type', 'notes', 'is_active',
        ])));

        return $holiday->refresh();
    }

    public function delete(OfficialHoliday $holiday): void
    {
        $holiday->delete();
    }

    /** The holiday covering a date, if any. */
    public function holidayOn(string $companyId, Carbon $date): ?OfficialHoliday
    {
        return OfficialHoliday::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->where('start_date', '<=', $date->toDateString())
            ->where('end_date', '>=', $date->toDateString())
            ->first();
    }

    public function isHoliday(string $companyId, Carbon $date): bool
    {
        return $this->holidayOn($companyId, $date) !== null;
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, OfficialHoliday> */
    public function between(string $companyId, Carbon $from, Carbon $to)
    {
        return OfficialHoliday::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->overlapping($from, $to)
            ->orderBy('start_date')
            ->get();
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, OfficialHoliday> */
    public function upcoming(string $companyId, int $days = 90)
    {
        $today = Carbon::now()->startOfDay();

        return $this->between($companyId, $today, $today->copy()->addDays($days));
    }
}
