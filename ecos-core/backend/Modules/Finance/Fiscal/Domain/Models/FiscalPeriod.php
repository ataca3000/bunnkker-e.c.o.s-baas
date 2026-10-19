<?php

declare(strict_types=1);

namespace Modules\Finance\Fiscal\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Finance\Fiscal\Domain\Enums\PeriodStatus;

/**
 * A fiscal period — the posting gate. A journal enters only while the period is
 * open; the Journal and Posting engines assert this on every entry.
 */
class FiscalPeriod extends Model
{
    protected $table = 'finance_fiscal_periods';

    /** @var array<string, mixed> */
    protected $attributes = ['status' => PeriodStatus::Future->value];

    protected $fillable = [
        'uuid', 'company_id', 'fiscal_year_id', 'period_number', 'name',
        'start_date', 'end_date', 'status',
        'opened_at', 'closed_at', 'closed_by', 'locked_at', 'locked_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => PeriodStatus::class,
            'period_number' => 'integer',
            'start_date' => 'date',
            'end_date' => 'date',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'locked_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $period): void {
            if ($period->uuid === null) {
                $period->uuid = (string) Str::uuid();
            }
        });
    }

    public function year(): BelongsTo
    {
        return $this->belongsTo(FiscalYear::class, 'fiscal_year_id');
    }

    public function acceptsPostings(): bool
    {
        return $this->status->acceptsPostings();
    }

    public function covers(Carbon $date): bool
    {
        return $date->betweenIncluded($this->start_date, $this->end_date);
    }
}
