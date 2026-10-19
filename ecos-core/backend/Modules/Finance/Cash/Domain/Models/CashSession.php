<?php

declare(strict_types=1);

namespace Modules\Finance\Cash\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * An open/close cycle on a cash account (a till shift). Transactions during the
 * session belong to it; closing records the counted amount so an over/short can
 * be surfaced against the expected movement.
 */
class CashSession extends Model
{
    protected $table = 'finance_cash_sessions';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'open',
        'opening_float' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'cash_account_id', 'status', 'opening_float',
        'opened_at', 'opened_by', 'counted_amount', 'closed_at', 'closed_by',
    ];

    protected function casts(): array
    {
        return [
            'opening_float' => 'decimal:4',
            'counted_amount' => 'decimal:4',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $session): void {
            if ($session->uuid === null) {
                $session->uuid = (string) Str::uuid();
            }
        });
    }

    public function cashAccount(): BelongsTo
    {
        return $this->belongsTo(CashAccount::class, 'cash_account_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(CashTransaction::class, 'cash_session_id');
    }

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }

    /** The net movement recorded in this session — derived from its transactions. */
    public function netMovement(): float
    {
        return round(
            (float) $this->transactions()
                ->where('status', 'posted')
                ->selectRaw("COALESCE(SUM(CASE WHEN transaction_type IN ('receipt','transfer_in') THEN amount ELSE -amount END), 0) AS net")
                ->value('net'),
            4,
        );
    }
}
