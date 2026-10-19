<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;

/**
 * An append-only governance record of a period-closing action (soft close, hard
 * close, reopen). The F1 period status stays the source of truth; this records
 * who decided what, and why.
 */
class PeriodClosure extends Model
{
    protected $table = 'finance_period_closures';

    protected $fillable = [
        'uuid', 'company_id', 'fiscal_period_id', 'action', 'close_type',
        'from_status', 'to_status', 'reason', 'actor_id',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $row): void {
            if ($row->uuid === null) {
                $row->uuid = (string) Str::uuid();
            }
        });

        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(FiscalPeriod::class, 'fiscal_period_id');
    }
}
