<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Intelligence\Domain\Enums\ChurnRiskBand;
use Modules\Crm\Intelligence\Domain\Enums\HealthBand;
use Modules\Crm\Intelligence\Domain\Enums\LifecycleStage;
use Modules\Crm\Intelligence\Domain\Enums\RfmSegment;

/**
 * The deterministic intelligence snapshot for one customer.
 *
 * A read model recomputed from the purchase facts. `explanation` carries the full
 * breakdown behind every score so results are inspectable, never a black box.
 */
class CustomerIntelligenceProfile extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_intelligence_profiles';

    protected $fillable = [
        'company_id', 'customer_id',
        'recency_days', 'frequency', 'monetary',
        'recency_score', 'frequency_score', 'monetary_score', 'rfm_segment',
        'average_order_value', 'lifetime_value', 'predicted_lifetime_value',
        'purchase_frequency_monthly', 'avg_interval_days', 'tenure_days',
        'churn_risk_score', 'churn_risk_band', 'health_score', 'health_band',
        'segment', 'lifecycle_stage', 'is_repeat', 'is_retained',
        'first_purchase_at', 'last_purchase_at', 'explanation', 'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'monetary' => 'decimal:2',
            'average_order_value' => 'decimal:2',
            'lifetime_value' => 'decimal:2',
            'predicted_lifetime_value' => 'decimal:2',
            'purchase_frequency_monthly' => 'decimal:4',
            'rfm_segment' => RfmSegment::class,
            'churn_risk_band' => ChurnRiskBand::class,
            'health_band' => HealthBand::class,
            'lifecycle_stage' => LifecycleStage::class,
            'is_repeat' => 'boolean',
            'is_retained' => 'boolean',
            'explanation' => 'array',
            'first_purchase_at' => 'datetime',
            'last_purchase_at' => 'datetime',
            'computed_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
