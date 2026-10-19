<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Modules\Hr\Attendance\Domain\Enums\HolidayType;

/** A company-wide non-working day or run of days. */
class OfficialHoliday extends Model
{
    use HasUuids;

    protected $table = 'hr_official_holidays';

    protected $fillable = ['company_id', 'name', 'start_date', 'end_date', 'type', 'notes', 'is_active'];

    protected function casts(): array
    {
        return [
            'type' => HolidayType::class,
            'start_date' => 'date',
            'end_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function covers(Carbon $date): bool
    {
        $day = $date->copy()->startOfDay();

        return $day->betweenIncluded($this->start_date->copy()->startOfDay(), $this->end_date->copy()->startOfDay());
    }

    public function days(): int
    {
        return (int) floor((float) $this->start_date->diffInDays($this->end_date)) + 1;
    }

    /** Holidays overlapping a window. */
    public function scopeOverlapping(Builder $query, Carbon $from, Carbon $to): Builder
    {
        return $query->where('start_date', '<=', $to->toDateString())
            ->where('end_date', '>=', $from->toDateString());
    }
}
