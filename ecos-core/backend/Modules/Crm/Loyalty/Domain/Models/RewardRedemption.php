<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A record of a reward redeemed against a loyalty account. */
class RewardRedemption extends Model
{
    use HasUuids;

    protected $table = 'crm_reward_redemptions';

    protected $fillable = [
        'company_id', 'account_id', 'reward_id', 'points_spent', 'status',
        'voucher_code', 'redeemed_at', 'fulfilled_at', 'actor_id',
    ];

    protected function casts(): array
    {
        return ['points_spent' => 'integer', 'redeemed_at' => 'datetime', 'fulfilled_at' => 'datetime'];
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(LoyaltyReward::class, 'reward_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(LoyaltyAccount::class, 'account_id');
    }
}
