<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AddCartLineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'string', 'uuid'],
            'product_name' => ['required', 'string', 'max:255'],
            'sku' => ['required', 'string', 'max:100'],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'currency' => ['required', 'string', 'size:3'],
            'discount_type' => ['nullable', 'string', 'in:percentage,fixed'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
