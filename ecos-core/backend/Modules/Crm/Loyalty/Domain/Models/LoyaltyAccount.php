<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A customer's loyalty account — the wallet. It stores NO balance; the balance
 * is the SUM of its append-only transactions.
 */
class LoyaltyAccount extends Model
{
    use HasUuids;

    protected $table = 'crm_loyalty_accounts';

    protected $fillable = ['company_id', 'program_id', 'customer_id', 'tier_id', 'status', 'enrolled_at'];

    protected function casts(): array
    {
        return ['enrolled_at' => 'datetime'];
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(LoyaltyProgram::class, 'program_id');
    }

    public function tier(): BelongsTo
    {
        return $this->belongsTo(LoyaltyTier::class, 'tier_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(LoyaltyTransaction::class, 'account_id');
    }

    /** The points balance — SUM of the ledger, never stored. */
    public function balance(): int
    {
        return (int) $this->transactions()->sum('points');
    }
}
