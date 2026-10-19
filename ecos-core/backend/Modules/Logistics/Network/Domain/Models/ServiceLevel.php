<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A named delivery promise — "Same Day", "Next Day".
 *
 * The level exists once per company; its cutoff and lead time vary per area
 * through CoverageRule, so the same promise can behave differently in Cairo
 * and Alexandria without duplicating the level.
 */
class ServiceLevel extends Model
{
    protected $table = 'network_service_levels';

    /** @var array<string, mixed> */
    protected $attributes = [
        'target_hours' => 24,
        'display_order' => 0,
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'code', 'name', 'description',
        'target_hours', 'display_order', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'target_hours' => 'integer',
            'display_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $level): void {
            if ($level->uuid === null) {
                $level->uuid = (string) Str::uuid();
            }
        });
    }

    public function coverageRules(): HasMany
    {
        return $this->hasMany(CoverageRule::class, 'service_level_id');
    }

    public function isSameDay(): bool
    {
        return $this->target_hours <= 24;
    }
}
