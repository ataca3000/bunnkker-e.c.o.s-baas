<?php

declare(strict_types=1);

namespace Modules\Sales\ShippingPricing\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Sales\ShippingPricing\Domain\Scopes\CompanyScope;

/**
 * @property string $id
 * @property string|null $company_id
 * @property string $governorate
 * @property string|null $city
 * @property string|null $area
 * @property float $standard_cost
 * @property float|null $express_cost
 * @property bool $is_active
 */
class ShippingPricingRule extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected static function booted(): void
    {
        static::addGlobalScope(new CompanyScope);
    }

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'governorate',
        'city',
        'area',
        'standard_cost',
        'express_cost',
        'is_active',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'standard_cost' => 'float',
            'express_cost' => 'float',
            'is_active' => 'boolean',
        ];
    }
}
