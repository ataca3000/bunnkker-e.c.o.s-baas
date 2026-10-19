<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ProcessExchangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'original_sale_id' => ['required', 'string', 'uuid'],
            'currency' => ['required', 'string', 'size:3'],
            'reason' => ['required', 'string', 'max:500'],
            'cashier_id' => ['required', 'string', 'uuid'],
            'cashier_name' => ['nullable', 'string', 'max:255'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'returned_lines' => ['required', 'array', 'min:1'],
            'returned_lines.*.original_line_id' => ['required', 'string'],
            'returned_lines.*.product_id' => ['required', 'string', 'uuid'],
            'returned_lines.*.product_name' => ['required', 'string', 'max:255'],
            'returned_lines.*.sku' => ['required', 'string', 'max:100'],
            'returned_lines.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'returned_lines.*.unit_price' => ['required', 'array'],
            'returned_lines.*.unit_price.amount' => ['required', 'numeric', 'min:0'],
            'returned_lines.*.unit_price.currency' => ['required', 'string', 'size:3'],
            'returned_lines.*.line_total' => ['required', 'array'],
            'returned_lines.*.line_total.amount' => ['required', 'numeric', 'min:0'],
            'returned_lines.*.line_total.currency' => ['required', 'string', 'size:3'],
            'returned_lines.*.sort_order' => ['sometimes', 'integer', 'min:0'],
            'replacement_lines' => ['required', 'array', 'min:1'],
            'replacement_lines.*.original_line_id' => ['nullable', 'string'],
            'replacement_lines.*.product_id' => ['required', 'string', 'uuid'],
            'replacement_lines.*.product_name' => ['required', 'string', 'max:255'],
            'replacement_lines.*.sku' => ['required', 'string', 'max:100'],
            'replacement_lines.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'replacement_lines.*.unit_price' => ['required', 'array'],
            'replacement_lines.*.unit_price.amount' => ['required', 'numeric', 'min:0'],
            'replacement_lines.*.unit_price.currency' => ['required', 'string', 'size:3'],
            'replacement_lines.*.line_total' => ['required', 'array'],
            'replacement_lines.*.line_total.amount' => ['required', 'numeric', 'min:0'],
            'replacement_lines.*.line_total.currency' => ['required', 'string', 'size:3'],
            'replacement_lines.*.sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
