<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Capacity for one service area on one date. Publishing makes its slots
 * bookable; an unpublished plan is a draft nobody can commit against.
 */
class CapacityPlan extends Model
{
    protected $table = 'network_capacity_plans';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_published' => false,
    ];

    protected $fillable = [
        'uuid', 'service_area_id', 'company_id', 'plan_date',
        'is_published', 'published_at', 'published_by', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'plan_date' => 'date:Y-m-d',
            'is_published' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $plan): void {
            if ($plan->uuid === null) {
                $plan->uuid = (string) Str::uuid();
            }
        });
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class, 'service_area_id');
    }

    public function slots(): HasMany
    {
        return $this->hasMany(CapacitySlot::class, 'capacity_plan_id');
    }

    public function isBookable(): bool
    {
        return $this->is_published;
    }

    /** @return array<string, float> */
    public function totalRemaining(): array
    {
        if (! $this->relationLoaded('slots')) {
            $this->load('slots');
        }

        $totals = [];
        foreach ($this->slots as $slot) {
            foreach ($slot->remaining() as $unit => $value) {
                $totals[$unit] = round(($totals[$unit] ?? 0) + $value, 3);
            }
        }

        return $totals;
    }
}
