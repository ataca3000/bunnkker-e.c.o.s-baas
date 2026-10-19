<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Crm\Loyalty\Domain\Enums\LoyaltyTransactionType;

/** One append-only movement on the loyalty points ledger. */
class LoyaltyTransaction extends Model
{
    use HasUuids;

    protected $table = 'crm_loyalty_transactions';

    protected $fillable = [
        'company_id', 'account_id', 'type', 'points', 'source_type', 'source_reference',
        'reward_id', 'description', 'occurred_at', 'actor_id',
    ];

    protected function casts(): array
    {
        return ['type' => LoyaltyTransactionType::class, 'points' => 'integer', 'occurred_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        // Append-only: the points ledger is never rewritten.
        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(LoyaltyAccount::class, 'account_id');
    }
}
