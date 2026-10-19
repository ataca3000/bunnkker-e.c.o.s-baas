<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\Core\BusinessAttribution\Domain\Enums\AttributionModel;
use Modules\Core\BusinessAttribution\Domain\Enums\DnaEntityType;

/**
 * Business DNA — the single attribution record for a business entity.
 *
 * @property string $id
 * @property DnaEntityType $entity_type
 * @property string $entity_id
 * @property string|null $origin_provider
 * @property string|null $origin_platform
 * @property string|null $provider_connector_id
 * @property string|null $initiative_id
 * @property string|null $campaign_id
 * @property string|null $ad_set_id
 * @property string|null $ad_id
 * @property string|null $creative_id
 * @property string|null $landing_page
 * @property string|null $conversation_source
 * @property string|null $lead_source
 * @property string|null $sales_rep_id
 * @property string|null $marketing_team
 * @property string|null $company_id
 * @property string|null $brand_id
 * @property string|null $channel_id
 * @property string|null $warehouse_id
 * @property string|null $cost_center
 * @property string|null $business_unit
 * @property array|null $first_touch
 * @property array|null $last_touch
 * @property Carbon|null $acquisition_timestamp
 * @property Carbon|null $conversion_timestamp
 * @property Carbon|null $repeat_purchase_timestamp
 * @property string|null $customer_lifetime_stage
 * @property string|null $internal_attribution_id
 * @property AttributionModel|null $attribution_model
 * @property array|null $provider_metadata
 * @property array|null $erp_metadata
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class BusinessDna extends Model
{
    use HasUuids;

    protected $table = 'bae_business_dna';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'entity_type' => DnaEntityType::class,
            'attribution_model' => AttributionModel::class,
            'first_touch' => 'array',
            'last_touch' => 'array',
            'provider_metadata' => 'array',
            'erp_metadata' => 'array',
            'acquisition_timestamp' => 'datetime',
            'conversion_timestamp' => 'datetime',
            'repeat_purchase_timestamp' => 'datetime',
        ];
    }

    public function journeySteps(): HasMany
    {
        return $this->hasMany(JourneyStep::class, 'business_dna_id')->orderBy('occurred_at');
    }

    public function events(): HasMany
    {
        return $this->hasMany(BusinessEvent::class, 'business_dna_id')->orderBy('occurred_at');
    }

    public function metrics(): HasOne
    {
        return $this->hasOne(BusinessMetric::class, 'business_dna_id');
    }

    public function isConverted(): bool
    {
        return $this->conversion_timestamp !== null;
    }

    public function hasRepeatPurchase(): bool
    {
        return $this->repeat_purchase_timestamp !== null;
    }
}
