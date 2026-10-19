<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;

final class StoreOrderRequest extends FormRequest
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
        ];
    }
}
