<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ProcessReturnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sale_id' => ['required', 'string', 'uuid'],
            'currency' => ['required', 'string', 'size:3'],
            'refund_total' => ['required', 'numeric', 'min:0.01'],
            'refund_method' => ['required', 'string', 'max:50'],
            'cashier_id' => ['required', 'string', 'uuid'],
            'cashier_name' => ['nullable', 'string', 'max:255'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.line_id' => ['required', 'string'],
            'lines.*.product_id' => ['required', 'string', 'uuid'],
            'lines.*.product_name' => ['required', 'string', 'max:255'],
            'lines.*.sku' => ['required', 'string', 'max:100'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'lines.*.unit_price' => ['required', 'array'],
            'lines.*.unit_price.amount' => ['required', 'numeric', 'min:0'],
            'lines.*.unit_price.currency' => ['required', 'string', 'size:3'],
            'lines.*.refund_amount' => ['required', 'array'],
            'lines.*.refund_amount.amount' => ['required', 'numeric', 'min:0'],
            'lines.*.refund_amount.currency' => ['required', 'string', 'size:3'],
            'lines.*.reason' => ['nullable', 'string', 'max:500'],
            'lines.*.should_restock' => ['sometimes', 'boolean'],
            'lines.*.sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
