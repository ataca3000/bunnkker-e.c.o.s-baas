<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Modules\Inventory\Products\Domain\Enums\CostSource;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Categories\Domain\Models\Category;

/**
 * Validation for creating a product.
 */
final class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $categoryId = $this->input('category_id');
            $productType = $this->input('product_type');

            if (! $categoryId || ! $productType) {
                return;
            }

            $expectedScope = in_array($productType, ['raw_material', 'packaging_material'], true)
                ? 'material'
                : 'product';

            $category = Category::query()->find($categoryId);
            if ($category && ($category->category_scope ?? 'product') !== $expectedScope) {
                $label = $expectedScope === 'product' ? 'a Product Category' : 'a Material Category';
                $v->errors()->add('category_id', "The selected category must be {$label}.");
            }
        });
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $isMaterial = in_array($this->input('product_type'), ['raw_material', 'packaging_material'], true);

        return [
            'sku' => ['required', 'string', 'max:100', 'unique:products,sku'],
            'barcode' => ['nullable', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'brand_id' => $isMaterial
                ? ['nullable', 'uuid', 'exists:brands,id']
                : ['required', 'uuid', 'exists:brands,id'],
            'category_id' => ['required', 'uuid', 'exists:categories,id'],
            'unit_id' => ['sometimes', 'nullable', 'uuid', 'exists:units,id'],
            'product_type' => ['required', Rule::in(Product::TYPES)],
            'cost_source' => ['sometimes', 'nullable', Rule::enum(CostSource::class)],
            'is_active' => ['boolean'],
            'can_manufacture' => ['boolean'],
            'can_disassemble' => ['boolean'],
            'allow_negative_stock' => ['boolean'],
            'image_url' => ['nullable', 'string', 'max:500'],
            'manual_cost' => ['nullable', 'numeric', 'min:0'],
            'regular_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'short_description' => ['nullable', 'string', 'max:500'],
            'long_description' => ['nullable', 'string'],
            'stock_status' => ['nullable', Rule::in(['instock', 'outofstock', 'onbackorder'])],
            'channel_ids' => ['sometimes', 'nullable', 'array'],
            'channel_ids.*' => ['uuid', 'exists:channels,id'],
            'pricing_mode' => ['nullable', 'string', Rule::in(['brand_policy', 'custom'])],
            'custom_target_margin' => ['nullable', 'numeric', 'min:0', 'max:99.9999'],
            'custom_markup' => ['nullable', 'numeric', 'min:0'],
            'custom_discount_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
