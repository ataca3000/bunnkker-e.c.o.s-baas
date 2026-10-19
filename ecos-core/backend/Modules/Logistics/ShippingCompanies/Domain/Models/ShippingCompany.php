<?php

declare(strict_types=1);

namespace Modules\Logistics\ShippingCompanies\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Shipping carrier used by ECOS — internal fleet or external provider.
 *
 * Business rules:
 *  - `code` is unique.
 *  - `type` (internal|external) is immutable after creation.
 *  - Archived companies cannot receive new contracts or company mappings.
 *  - At most one contract may be active at a time.
 */
class ShippingCompany extends Model
{
    public const TYPE_INTERNAL = 'internal';

    public const TYPE_EXTERNAL = 'external';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_ARCHIVED = 'archived';

    public const TYPES = [self::TYPE_INTERNAL, self::TYPE_EXTERNAL];

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE, self::STATUS_ARCHIVED];

    protected $table = 'logistics_shipping_companies';

    protected $fillable = [
        'name',
        'code',
        'type',
        'contact_person',
        'phone',
        'email',
        'address',
        'notes',
        'status',
    ];

    public function contracts(): HasMany
    {
        return $this->hasMany(ShippingContract::class, 'shipping_company_id')
            ->orderByDesc('status')
            ->orderByDesc('start_date');
    }

    public function activeContract(): HasOne
    {
        return $this->hasOne(ShippingContract::class, 'shipping_company_id')
            ->where('status', ShippingContract::STATUS_ACTIVE);
    }

    public function mappings(): HasMany
    {
        return $this->hasMany(ShippingCompanyMapping::class, 'shipping_company_id');
    }

    public function isArchived(): bool
    {
        return $this->status === self::STATUS_ARCHIVED;
    }
}
