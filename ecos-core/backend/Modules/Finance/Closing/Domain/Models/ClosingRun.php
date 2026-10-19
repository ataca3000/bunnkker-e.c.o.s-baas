<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Closing\Domain\Enums\ClosingRunStatus;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;

/**
 * A closing run — the controlled workflow that validates and closes a period or
 * year. It orchestrates F1 transitions; it never writes the ledger.
 */
class ClosingRun extends Model
{
    protected $table = 'finance_closing_runs';

    /** @var array<string, mixed> */
    protected $attributes = ['status' => 'draft'];

    protected $fillable = [
        'uuid', 'company_id', 'scope', 'fiscal_period_id', 'fiscal_year_id',
        'status', 'readiness_score', 'notes', 'initiated_by', 'approved_by',
        'validated_at', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ClosingRunStatus::class,
            'readiness_score' => 'decimal:2',
            'validated_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $run): void {
            if ($run->uuid === null) {
                $run->uuid = (string) Str::uuid();
            }
        });
    }

    public function items(): HasMany
    {
        return $this->hasMany(ClosingChecklistItem::class, 'closing_run_id');
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(FiscalPeriod::class, 'fiscal_period_id');
    }

    public function year(): BelongsTo
    {
        return $this->belongsTo(FiscalYear::class, 'fiscal_year_id');
    }
}
