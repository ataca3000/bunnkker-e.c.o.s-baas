<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreManualOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // ── Customer resolution (one of these two blocks required) ──────
            'customer_id' => 'nullable|uuid|exists:customers,id',
            'customer_name' => 'required_without:customer_id|string|max:255',
            'customer_phone' => 'nullable|string|max:30',
            'customer_secondary_phone' => 'nullable|string|max:30',
            'customer_notes' => 'nullable|string|max:1000',

            // ── Delivery ─────────────────────────────────────────────────────
            'requested_delivery_date' => 'nullable|date',
            'preferred_delivery_time' => 'nullable|in:morning,afternoon,evening,any',
            'delivery_window_id' => 'nullable|uuid|exists:brand_delivery_time_slots,id',
            'delivery_window' => 'nullable|string|max:100',

            // ── Payment ──────────────────────────────────────────────────────
            'payment_method_manual' => 'nullable|in:cod,instapay,mobile_wallet,credit_card,bank_transfer',
            'payment_proof_path' => 'nullable|string|max:500',

            // ── Location / shipping ───────────────────────────────────────────
            'governorate' => 'nullable|string|max:100',
            'governorate_id' => 'nullable|integer',
            'city' => 'nullable|string|max:100',
            'city_id' => 'nullable|integer',
            'area' => 'nullable|string|max:100',
            'shipping_address' => 'nullable|string|max:500',
            'building' => 'nullable|string|max:100',
            'floor' => 'nullable|string|max:50',
            'apartment' => 'nullable|string|max:50',
            'landmark' => 'nullable|string|max:200',
            'address_notes' => 'nullable|string|max:500',
            'google_maps_lat' => 'nullable|numeric|between:-90,90',
            'google_maps_lng' => 'nullable|numeric|between:-180,180',
            'google_maps_url' => 'nullable|string|max:500',
            'location_source' => 'nullable|string|in:google_maps,manual',
            'shipping_cost' => 'nullable|numeric|min:0',
            'shipping_cost_source' => 'nullable|in:auto,override',

            // ── Financials ───────────────────────────────────────────────────
            'discount_amount' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:percentage,fixed',
            'deposit_amount' => 'nullable|numeric|min:0',

            // ── Brand delivery zone ──────────────────────────────────────────
            'delivery_zone_id' => 'nullable|uuid|exists:config_delivery_zones,id',
            'delivery_zone' => 'nullable|string|max:150',

            // ── Order meta ───────────────────────────────────────────────────
            'company_id' => 'nullable|uuid|exists:companies,id',
            'channel_id' => 'nullable|uuid|exists:channels,id',
            'order_date' => 'nullable|date',
            'status' => 'nullable|string|in:pending,scheduled,processing,awaiting_payment,completed,cancelled',
            'notes' => 'nullable|string|max:2000',

            // ── Lines ────────────────────────────────────────────────────────
            'lines' => 'required|array|min:1',
            'lines.*.product_id' => 'required|uuid|exists:products,id',
            'lines.*.quantity' => 'required|numeric|min:0.0001',
            'lines.*.unit_price' => 'required|numeric|min:0',
        ];
    }
}
