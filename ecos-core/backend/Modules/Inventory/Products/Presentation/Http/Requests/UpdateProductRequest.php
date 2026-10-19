<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Modules\Inventory\Products\Domain\Enums\CostSource;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Categories\Domain\Models\Category;

/**
 * Validation for updating a product. The unique `sku` rule ignores the product
 * being updated.
 */
final class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Reject a reclassification while the product still holds stock.
     *
     * ┌─ WHY THIS IS BLOCKED RATHER THAN ALLOWED ───────────────────────────┐
     * │ product_type decides which GL account a stock movement posts to. If  │
     * │ it changes while stock exists, every FUTURE movement posts to the    │
     * │ new account while the value already on the books stays on the old    │
     * │ one. Nothing errors; the two accounts simply drift apart forever,    │
     * │ and the difference is invisible until someone reconciles inventory   │
     * │ to the ledger.                                                       │
     * │                                                                      │
     * │ At zero stock there is no value to strand, so the change is safe.    │
     * │                                                                      │
     * │ Approved as Decision 3 of EPIC-FIN-INTEGRATION-003A.                 │
     * └──────────────────────────────────────────────────────────────────────┘
     *
     * FUTURE INTEGRATION POINT — Inventory Reclassification Journal.
     * Reclassifying stocked product belongs in a journal that moves the value
     * between the two inventory accounts as it changes the type, so the books
     * and the classification move together. When that exists, this guard is
     * where it hooks in: instead of rejecting, hand off to the journal. Do not
     * relax this check until that journal can move the value.
     */
    private function rejectReclassificationWhileStockExists(Validator $v): void
    {
        $requested = $this->input('product_type');

        if (! is_string($requested) || $requested === '') {
            return;
        }

        $product = $this->route('product');
        $productId = is_object($product) ? ($product->id ?? null) : $product;

        if (! is_string($productId) || $productId === '') {
            return;
        }

        $current = Product::query()->whereKey($productId)->value('product_type');

        if ($current === null || $current === $requested) {
            return; // not a reclassification
        }

        $onHand = (float) DB::table('inventory_items')
            ->where('product_id', $productId)
            ->whereNull('deleted_at')
            ->sum('on_hand_qty');

        if ($onHand > 0.0) {
            $v->errors()->add('product_type', sprintf(
                'This product cannot be reclassified from %s to %s while it holds stock '
                .'(%s on hand). Its value is already recorded against the %s inventory '
                .'account. Reduce the balance to zero first, or use an Inventory '
                .'Reclassification Journal to move the value with the classification.',
                $current,
                $requested,
                rtrim(rtrim(number_format($onHand, 4, '.', ''), '0'), '.'),
                $current,
            ));
        }
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $this->rejectReclassificationWhileStockExists($v);
        });

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
        $productId = (string) $this->route('product');

        return [
            'sku' => ['required', 'string', 'max:100', Rule::unique('products', 'sku')->ignore($productId)],
            'barcode' => ['nullable', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            // brand_id is accepted but overridden by the controller (immutable after creation)
            'brand_id' => ['sometimes', 'nullable', 'uuid'],
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
