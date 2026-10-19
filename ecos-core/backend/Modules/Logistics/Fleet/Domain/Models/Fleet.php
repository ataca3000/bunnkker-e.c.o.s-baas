<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompany;

/**
 * An ownership / operating-model boundary: "Cairo Own Fleet", "Delta 3PL Fleet".
 *
 * Purely organisational — holds no vehicle attribute. A null shipping_company_id
 * means an own fleet; a set one references LOG-001 rather than duplicating it.
 */
class Fleet extends Model
{
    protected $table = 'fleet_fleets';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'shipping_company_id',
        'code', 'name', 'description', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $fleet): void {
            if ($fleet->uuid === null) {
                $fleet->uuid = (string) Str::uuid();
            }
        });
    }

    public function groups(): HasMany
    {
        return $this->hasMany(FleetGroup::class, 'fleet_id');
    }

    /** LOG-001, by reference. Null for an own fleet. */
    public function shippingCompany(): BelongsTo
    {
        return $this->belongsTo(ShippingCompany::class, 'shipping_company_id');
    }

    public function isOwnFleet(): bool
    {
        return $this->shipping_company_id === null;
    }
}
