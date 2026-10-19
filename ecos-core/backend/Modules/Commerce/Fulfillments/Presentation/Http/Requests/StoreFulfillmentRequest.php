<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreFulfillmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'order_id' => ['required', 'uuid', 'exists:orders,id'],
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'fulfillment_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['required', 'uuid', 'exists:products,id'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.0001'],
        ];
    }
}
