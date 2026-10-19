<?php

declare(strict_types=1);

namespace Modules\Logistics\ShippingCompanies\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Link between a shipping company and an ECOS company.
 * One shipping company may serve many ECOS companies.
 */
class ShippingCompanyMapping extends Model
{
    protected $table = 'logistics_shipping_company_mappings';

    protected $fillable = [
        'shipping_company_id',
        'company_id',
    ];

    public function shippingCompany(): BelongsTo
    {
        return $this->belongsTo(ShippingCompany::class, 'shipping_company_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}
