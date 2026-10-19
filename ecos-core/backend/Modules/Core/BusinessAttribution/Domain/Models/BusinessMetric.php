<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Calculated journey metrics for a Business DNA record.
 * Recalculated each time a new journey step is recorded.
 *
 * @property string $id
 * @property string $business_dna_id
 * @property int|null $time_to_first_contact_s
 * @property int|null $lead_to_quote_s
 * @property int|null $quote_to_order_s
 * @property int|null $order_to_payment_s
 * @property int|null $payment_to_preparation_s
 * @property int|null $preparation_to_packing_s
 * @property int|null $packing_to_shipment_s
 * @property int|null $shipment_to_delivery_s
 * @property int|null $delivery_to_repeat_s
 * @property int|null $customer_lifetime_duration_s
 * @property int|null $total_journey_time_s
 * @property Carbon $calculated_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class BusinessMetric extends Model
{
    use HasUuids;

    protected $table = 'bae_business_metrics';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'calculated_at' => 'datetime',
            'time_to_first_contact_s' => 'integer',
            'lead_to_quote_s' => 'integer',
            'quote_to_order_s' => 'integer',
            'order_to_payment_s' => 'integer',
            'payment_to_preparation_s' => 'integer',
            'preparation_to_packing_s' => 'integer',
            'packing_to_shipment_s' => 'integer',
            'shipment_to_delivery_s' => 'integer',
            'delivery_to_repeat_s' => 'integer',
            'customer_lifetime_duration_s' => 'integer',
            'total_journey_time_s' => 'integer',
        ];
    }

    public function dna(): BelongsTo
    {
        return $this->belongsTo(BusinessDna::class, 'business_dna_id');
    }

    public function fmtDuration(int $seconds): string
    {
        if ($seconds < 60) {
            return "{$seconds}s";
        }
        if ($seconds < 3600) {
            return round($seconds / 60).'m';
        }
        if ($seconds < 86400) {
            return round($seconds / 3600).'h';
        }

        return round($seconds / 86400).'d';
    }
}
