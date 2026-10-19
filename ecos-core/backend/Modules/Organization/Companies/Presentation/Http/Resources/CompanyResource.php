<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * @mixin Company
 */
final class CompanyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'legal_name' => $this->legal_name,
            'tax_number' => $this->tax_number,
            'commercial_registration' => $this->commercial_registration,
            'email' => $this->email,
            'phone' => $this->phone,
            'mobile' => $this->mobile,
            'website' => $this->website,
            'currency' => $this->currency,
            'timezone' => $this->timezone,
            'language' => $this->language,
            'locale' => $this->locale,
            'date_format' => $this->date_format,
            'number_format' => $this->number_format,
            'week_start' => $this->week_start,
            'fiscal_year_start' => $this->fiscal_year_start?->toDateString(),
            'fiscal_year_end' => $this->fiscal_year_end?->toDateString(),
            'description' => $this->description,
            'country' => $this->country,
            'city' => $this->city,
            'address' => $this->address,
            'postal_code' => $this->postal_code,
            'logo' => $this->logo,
            'is_active' => (bool) $this->is_active,
            'brands_count' => (int) ($this->brands_count ?? 0),
            'warehouses_count' => (int) ($this->warehouses_count ?? 0),
            'teams_count' => (int) ($this->teams_count ?? 0),
            'channels_count' => 0, // channels moved to Brand ownership; kept for API compat
            'business_accounts_count' => (int) ($this->business_accounts_count ?? 0),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
