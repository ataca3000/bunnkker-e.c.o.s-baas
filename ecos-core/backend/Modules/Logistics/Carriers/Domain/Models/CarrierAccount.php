<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompany;

/**
 * A connected carrier account.
 *
 * ┌─ DIRECTIVE 4 — NO DUPLICATE MASTER DATA ────────────────────────────────┐
 * │ Carrier IDENTITY lives in LOG-001 (logistics_shipping_companies) and is  │
 * │ referenced here. This model owns CONNECTIVITY: which adapter, what it    │
 * │ can do, and how its vocabulary maps onto ECOS's.                         │
 * │                                                                          │
 * │ CREDENTIALS ARE NOT HERE. provider_reference points into the existing    │
 * │ Provider Platform's encrypted store. Building a second credential vault  │
 * │ would be exactly the duplication Directive 4 exists to prevent.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CarrierAccount extends Model
{
    public const MODE_INTERNAL = 'internal';

    public const MODE_EXTERNAL = 'external';

    public const STATUS_DRAFT = 'draft';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_DISABLED = 'disabled';

    protected $table = 'carrier_accounts';

    /** @var array<string, mixed> */
    protected $attributes = [
        'mode' => self::MODE_INTERNAL,
        'status' => self::STATUS_DRAFT,
        'is_default' => false,
        'priority' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'shipping_company_id', 'adapter_key',
        'code', 'name', 'mode', 'status', 'provider_reference',
        'is_default', 'priority', 'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'priority' => 'integer',
        ];
    }

    /** Never expose the credential pointer through an API resource. */
    protected $hidden = ['provider_reference'];

    protected static function booted(): void
    {
        static::creating(function (self $account): void {
            if ($account->uuid === null) {
                $account->uuid = (string) Str::uuid();
            }
        });
    }

    /** LOG-001 by reference. Null for the internal own-fleet carrier. */
    public function shippingCompany(): BelongsTo
    {
        return $this->belongsTo(ShippingCompany::class, 'shipping_company_id');
    }

    public function capabilities(): HasMany
    {
        return $this->hasMany(CarrierCapability::class, 'carrier_account_id');
    }

    public function statusMappings(): HasMany
    {
        return $this->hasMany(CarrierStatusMapping::class, 'carrier_account_id');
    }

    /**
     * Own fleet is a FIRST-CLASS carrier, so the core cannot tell the
     * difference between delivering ourselves and tendering out.
     */
    public function isInternal(): bool
    {
        return $this->mode === self::MODE_INTERNAL;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /** True once credentials have been stored in the Provider Platform. */
    public function hasCredentials(): bool
    {
        return $this->provider_reference !== null;
    }

    /** @return list<string> */
    public function supportedCapabilities(): array
    {
        if (! $this->relationLoaded('capabilities')) {
            $this->load('capabilities');
        }

        return $this->capabilities
            ->where('is_supported', true)
            ->pluck('capability')
            ->values()
            ->all();
    }
}
