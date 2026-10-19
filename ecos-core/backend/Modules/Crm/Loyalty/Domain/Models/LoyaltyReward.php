<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A catalogue reward redeemable for points. */
class LoyaltyReward extends Model
{
    use HasUuids;

    protected $table = 'crm_loyalty_rewards';

    protected $fillable = ['company_id', 'program_id', 'name', 'description', 'points_cost', 'reward_type', 'value', 'stock', 'is_active'];

    protected function casts(): array
    {
        return ['points_cost' => 'integer', 'value' => 'decimal:2', 'stock' => 'integer', 'is_active' => 'boolean'];
    }

    public function inStock(): bool
    {
        return $this->stock === null || $this->stock > 0;
    }
}
