<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Named, versioned assignment rules.
 *
 * Scoring weights are CONFIGURATION, not code, so a dispatcher's priorities can
 * change without a deploy. `allow_auto_release` is opt-in per policy: the
 * default is a human, because a proposal that commits itself defeats the
 * propose/release separation of duties.
 */
class DispatchPolicy extends Model
{
    protected $table = 'dispatch_policies';

    /** @var array<string, mixed> */
    protected $attributes = [
        'version' => 1,
        'weight_capacity_fit' => 40,
        'weight_fitness' => 30,
        'weight_zone_affinity' => 20,
        'weight_utilisation' => 10,
        'allow_auto_release' => false,
        'is_active' => true,
        'active_flag' => 1,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'code', 'name', 'version',
        'weight_capacity_fit', 'weight_fitness', 'weight_zone_affinity',
        'weight_utilisation', 'allow_auto_release', 'is_active', 'active_flag',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'weight_capacity_fit' => 'integer',
            'weight_fitness' => 'integer',
            'weight_zone_affinity' => 'integer',
            'weight_utilisation' => 'integer',
            'allow_auto_release' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $policy): void {
            if ($policy->uuid === null) {
                $policy->uuid = (string) Str::uuid();
            }
        });
    }

    /** @return array<string, int> */
    public function weights(): array
    {
        return [
            'capacity_fit' => $this->weight_capacity_fit,
            'fitness' => $this->weight_fitness,
            'zone_affinity' => $this->weight_zone_affinity,
            'utilisation' => $this->weight_utilisation,
        ];
    }

    public function totalWeight(): int
    {
        return max(1, array_sum($this->weights()));
    }
}
