<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Fleet\Domain\Enums\InspectionKind;

/**
 * A versioned checklist. Editing produces a new version; the old one is
 * released (active_flag = null) rather than mutated, so historical inspections
 * stay readable.
 */
class InspectionTemplate extends Model
{
    protected $table = 'fleet_inspection_templates';

    /** @var array<string, mixed> */
    protected $attributes = [
        'version' => 1,
        'is_active' => true,
        'active_flag' => 1,
    ];

    protected $fillable = [
        'uuid', 'fleet_group_id', 'company_id',
        'code', 'name', 'kind', 'version', 'is_active', 'active_flag',
    ];

    protected function casts(): array
    {
        return [
            'kind' => InspectionKind::class,
            'version' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $template): void {
            if ($template->uuid === null) {
                $template->uuid = (string) Str::uuid();
            }
        });
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(FleetGroup::class, 'fleet_group_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InspectionTemplateItem::class, 'template_id')
            ->orderBy('display_order');
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(Inspection::class, 'template_id');
    }

    /** A released version keeps its rows but is no longer offered. */
    public function isLive(): bool
    {
        return $this->active_flag !== null;
    }

    public function mandatoryItemCount(): int
    {
        if (! $this->relationLoaded('items')) {
            $this->load('items');
        }

        return $this->items->where('is_mandatory', true)->count();
    }
}
