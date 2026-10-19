<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessMetric;

/** @mixin BusinessMetric */
class BusinessMetricResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'business_dna_id' => $this->business_dna_id,
            'time_to_first_contact_s' => $this->time_to_first_contact_s,
            'lead_to_quote_s' => $this->lead_to_quote_s,
            'quote_to_order_s' => $this->quote_to_order_s,
            'order_to_payment_s' => $this->order_to_payment_s,
            'payment_to_preparation_s' => $this->payment_to_preparation_s,
            'preparation_to_packing_s' => $this->preparation_to_packing_s,
            'packing_to_shipment_s' => $this->packing_to_shipment_s,
            'shipment_to_delivery_s' => $this->shipment_to_delivery_s,
            'delivery_to_repeat_s' => $this->delivery_to_repeat_s,
            'customer_lifetime_duration_s' => $this->customer_lifetime_duration_s,
            'total_journey_time_s' => $this->total_journey_time_s,
            'calculated_at' => $this->calculated_at?->toIso8601String(),
        ];
    }
}
