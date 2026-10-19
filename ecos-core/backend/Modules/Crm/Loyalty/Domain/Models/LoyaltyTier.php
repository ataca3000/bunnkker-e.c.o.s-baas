<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A membership level reached by points balance. */
class LoyaltyTier extends Model
{
    use HasUuids;

    protected $table = 'crm_loyalty_tiers';

    protected $fillable = ['program_id', 'name', 'min_points', 'earn_multiplier', 'benefits', 'order'];

    protected function casts(): array
    {
        return ['min_points' => 'integer', 'earn_multiplier' => 'decimal:2', 'benefits' => 'array', 'order' => 'integer'];
    }
}
