<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A loyalty program — its earn and redeem rates and its tiers. */
class LoyaltyProgram extends Model
{
    use HasUuids;

    protected $table = 'crm_loyalty_programs';

    protected $fillable = ['company_id', 'name', 'points_per_currency', 'redeem_rate', 'currency', 'is_active'];

    protected function casts(): array
    {
        return ['points_per_currency' => 'decimal:4', 'redeem_rate' => 'decimal:6', 'is_active' => 'boolean'];
    }

    public function tiers(): HasMany
    {
        return $this->hasMany(LoyaltyTier::class, 'program_id')->orderBy('min_points');
    }

    public function rewards(): HasMany
    {
        return $this->hasMany(LoyaltyReward::class, 'program_id');
    }
}
