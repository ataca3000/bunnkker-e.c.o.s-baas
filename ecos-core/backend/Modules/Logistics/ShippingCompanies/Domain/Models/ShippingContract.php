<?php

declare(strict_types=1);

namespace Modules\Logistics\ShippingCompanies\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Commercial contract between ECOS and a shipping company.
 * A shipping company may hold many contracts; at most one is active.
 */
class ShippingContract extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE];

    protected $table = 'logistics_shipping_contracts';

    /**
     * Domain default: a new contract is dormant until explicitly activated,
     * so it can never silently violate the one-active-contract rule.
     * Declared here (not only as a DB default) so the value is present on the
     * freshly created instance the API serialises back to the client.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => self::STATUS_INACTIVE,
    ];

    protected $fillable = [
        'shipping_company_id',
        'name',
        'start_date',
        'end_date',
        'payment_terms',
        'notes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    public function shippingCompany(): BelongsTo
    {
        return $this->belongsTo(ShippingCompany::class, 'shipping_company_id');
    }

    public function isExpired(): bool
    {
        return $this->end_date !== null && $this->end_date->lt(Carbon::today());
    }
}
