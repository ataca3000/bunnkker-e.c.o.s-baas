<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;

final class UpdateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $statuses = array_column(OrderStatus::cases(), 'value');

        return [
            // Core fields
            'channel_id' => ['nullable', 'uuid', 'exists:channels,id'],
            'customer_id' => ['required', 'uuid', 'exists:customers,id'],
            'external_order_id' => ['nullable', 'string', 'max:255'],
            'order_date' => ['required', 'date'],
            'status' => ['required', 'string', Rule::in($statuses)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['required', 'uuid', 'exists:products,id'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0'],
            'lines.*.unit_price' => ['required', 'numeric', 'gte:0'],
            // Enterprise customer snapshot fields — written to the order, not the Customer record
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'billing_phone' => ['nullable', 'string', 'max:50'],
            'customer_secondary_phone' => ['nullable', 'string', 'max:50'],
            'customer_notes' => ['nullable', 'string', 'max:1000'],
            'governorate' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'area' => ['nullable', 'string', 'max:100'],
            'shipping_address' => ['nullable', 'string', 'max:500'],
            'building' => ['nullable', 'string', 'max:100'],
            'floor' => ['nullable', 'string', 'max:50'],
            'apartment' => ['nullable', 'string', 'max:50'],
            'landmark' => ['nullable', 'string', 'max:200'],
            'address_notes' => ['nullable', 'string', 'max:500'],
            'delivery_zone_id' => ['nullable', 'string', 'max:255'],
            'delivery_zone' => ['nullable', 'string', 'max:255'],
            'google_maps_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'google_maps_lng' => ['nullable', 'numeric', 'between:-180,180'],
            'google_maps_url' => ['nullable', 'string', 'max:2000'],
            'location_source' => ['nullable', 'string', 'max:50'],
            // Enterprise payment/financial fields
            'payment_method_manual' => ['nullable', 'string', 'max:100'],
            'shipping_cost' => ['nullable', 'numeric', 'min:0'],
            'shipping_cost_source' => ['nullable', 'string', 'max:50'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'discount_type' => ['nullable', 'string', 'in:percentage,fixed'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            // Delivery scheduling
            'requested_delivery_date' => ['nullable', 'date'],
            'delivery_window_id' => ['nullable', 'string', 'max:255'],
            'delivery_window' => ['nullable', 'string', 'max:255'],
        ];
    }
}
