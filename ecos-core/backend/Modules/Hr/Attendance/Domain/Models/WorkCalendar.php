<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/** Which weekdays the company works, and the default hours of a working day. */
class WorkCalendar extends Model
{
    use HasUuids;

    protected $table = 'hr_work_calendars';

    protected $fillable = [
        'company_id', 'code', 'name', 'working_days',
        'default_start_time', 'default_end_time', 'is_default', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'working_days' => 'array',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function shifts(): HasMany
    {
        return $this->hasMany(Shift::class, 'work_calendar_id');
    }

    /** Is this date a working weekday? ISO numbering: 1 = Monday … 7 = Sunday. */
    public function isWorkingDay(Carbon $date): bool
    {
        return in_array((int) $date->isoWeekday(), array_map('intval', (array) $this->working_days), true);
    }
}
