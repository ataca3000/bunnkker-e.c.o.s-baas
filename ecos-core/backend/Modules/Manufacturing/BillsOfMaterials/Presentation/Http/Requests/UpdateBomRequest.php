<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateBomRequest extends FormRequest
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
        $productId = (string) $this->input('product_id', '');

        return [
            'product_id' => ['required', 'uuid', 'exists:products,id'],
            'version' => ['required', 'string', 'max:20'],
            'is_active' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'manufacturing_cost' => ['nullable', 'numeric', 'min:0'],
            'other_costs' => ['nullable', 'numeric', 'min:0'],
            'yield_quantity' => ['nullable', 'numeric', 'min:0.0001'],
            'execution_instructions' => ['nullable', 'string', 'max:5000'],
            // Optional on update: omitting `lines` means "leave the recipe's
            // components alone" (see BomDTO). `min:1` still applies when they
            // ARE sent, so this endpoint can never empty a recipe.
            'lines' => ['sometimes', 'array', 'min:1'],
            'lines.*.raw_material_id' => [
                'required',
                'uuid',
                'exists:products,id',
                // Component must not be the same product as the recipe output.
                Rule::notIn(array_filter([$productId])),
            ],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.0001'],
            'lines.*.waste_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'lines.*.raw_material_id.not_in' => 'A component cannot be the same product as the recipe output.',
        ];
    }
}
