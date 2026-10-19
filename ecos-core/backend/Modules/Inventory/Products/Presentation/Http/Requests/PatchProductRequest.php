<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates partial (PATCH) updates to a product.
 * All fields are optional — only the fields present in the request are validated and applied.
 */
final class PatchProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'allow_negative_stock' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'stock_status' => ['sometimes', 'string', 'in:instock,outofstock,onbackorder'],
            'manual_cost' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'regular_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'sale_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ];
    }
}
