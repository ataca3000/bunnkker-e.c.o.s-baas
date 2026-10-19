<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * What a service level actually promises in a given area: cutoff, lead time,
 * surcharge and which days are served.
 */
class CoverageRule extends Model
{
    protected $table = 'network_coverage_rules';

    private const DAY_COLUMNS = [
        0 => 'serves_sunday',
        1 => 'serves_monday',
        2 => 'serves_tuesday',
        3 => 'serves_wednesday',
        4 => 'serves_thursday',
        5 => 'serves_friday',
        6 => 'serves_saturday',
    ];

    /** @var array<string, mixed> */
    protected $attributes = [
        'lead_time_hours' => 24,
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'service_area_id', 'service_level_id',
        'cutoff_time', 'lead_time_hours', 'surcharge', 'currency',
        'serves_sunday', 'serves_monday', 'serves_tuesday', 'serves_wednesday',
        'serves_thursday', 'serves_friday', 'serves_saturday',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'lead_time_hours' => 'integer',
            'surcharge' => 'decimal:2',
            'is_active' => 'boolean',
            'serves_sunday' => 'boolean',
            'serves_monday' => 'boolean',
            'serves_tuesday' => 'boolean',
            'serves_wednesday' => 'boolean',
            'serves_thursday' => 'boolean',
            'serves_friday' => 'boolean',
            'serves_saturday' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $rule): void {
            if ($rule->uuid === null) {
                $rule->uuid = (string) Str::uuid();
            }
        });
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class, 'service_area_id');
    }

    public function level(): BelongsTo
    {
        return $this->belongsTo(ServiceLevel::class, 'service_level_id');
    }

    public function servesDay(Carbon $date): bool
    {
        return (bool) $this->{self::DAY_COLUMNS[$date->dayOfWeek]};
    }

    /** Orders placed after the cutoff roll to the next served day. */
    public function isPastCutoff(?Carbon $at = null): bool
    {
        if ($this->cutoff_time === null) {
            return false;
        }

        $at ??= Carbon::now();
        $cutoff = Carbon::parse($at->toDateString().' '.$this->cutoff_time);

        return $at->gt($cutoff);
    }

    /**
     * The earliest date this rule can actually serve, honouring cutoff, lead
     * time and served days. Looks ahead a bounded number of days so a rule that
     * serves nothing returns null rather than looping.
     */
    public function earliestServiceDate(?Carbon $from = null, int $horizonDays = 14): ?Carbon
    {
        $from ??= Carbon::now();

        $candidate = $from->copy()->addHours($this->lead_time_hours);

        if ($this->isPastCutoff($from)) {
            $candidate->addDay();
        }

        for ($i = 0; $i <= $horizonDays; $i++) {
            $day = $candidate->copy()->addDays($i)->startOfDay();

            if ($this->servesDay($day)) {
                return $day;
            }
        }

        return null;
    }
}
