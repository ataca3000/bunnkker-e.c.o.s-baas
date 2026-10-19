<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A named working window. Declares when work is expected; totals nothing. */
class Shift extends Model
{
    use HasUuids;

    protected $table = 'hr_shifts';

    protected $fillable = [
        'company_id', 'work_calendar_id', 'code', 'name',
        'start_time', 'end_time', 'break_minutes', 'crosses_midnight', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'break_minutes' => 'integer',
            'crosses_midnight' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function workCalendar(): BelongsTo
    {
        return $this->belongsTo(WorkCalendar::class, 'work_calendar_id');
    }
}
