<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Network\Domain\Enums\CoverageMemberType;

/**
 * THE ANTI-DUPLICATION SEAM (Directive 8).
 *
 * A pointer at a row that already exists in V1: a distribution_zone, a
 * logistics_city or a logistics_governorate. It carries no name, no coordinate
 * and no parent — only the reference and whether it includes or excludes.
 *
 * If this class ever gains a `city_name` accessor backed by a column rather
 * than the relation, the boundary has been broken.
 */
class ServiceAreaMember extends Model
{
    protected $table = 'network_service_area_members';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_excluded' => false,
    ];

    protected $fillable = [
        'service_area_id', 'member_type', 'member_id', 'is_excluded', 'added_by',
    ];

    protected function casts(): array
    {
        return [
            'member_type' => CoverageMemberType::class,
            'is_excluded' => 'boolean',
        ];
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class, 'service_area_id');
    }

    /**
     * Resolve the referenced V1 row. Deliberately a lookup rather than an
     * Eloquent morph, because the three targets have different key types
     * (BIGINT zone, UUID city and governorate).
     */
    public function resolveTarget(): ?Model
    {
        $class = $this->member_type->modelClass();

        /** @var class-string<Model> $class */
        return $class::query()->find($this->member_id);
    }

    /** Display name, read live from V1 — never stored here. */
    public function targetName(): ?string
    {
        $target = $this->resolveTarget();

        if ($target === null) {
            return null;
        }

        return $target->name_en ?? $target->name ?? $target->code ?? null;
    }

    public function specificity(): int
    {
        return $this->member_type->specificity();
    }
}
