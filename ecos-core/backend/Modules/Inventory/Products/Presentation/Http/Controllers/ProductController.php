<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use BackedEnum;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\CostManagement\Domain\Enums\CostUpdateSource;
use Modules\CostManagement\Domain\Services\MaterialCostService;
use Modules\Inventory\Products\Application\Actions\CreateProductAction;
use Modules\Inventory\Products\Application\Actions\DeleteProductAction;
use Modules\Inventory\Products\Application\Actions\GetProductAction;
use Modules\Inventory\Products\Application\Actions\ListProductsAction;
use Modules\Inventory\Products\Application\Actions\UpdateProductAction;
use Modules\Inventory\Products\Application\DTO\ProductDTO;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\Products\Presentation\Http\Requests\PatchProductRequest;
use Modules\Inventory\Products\Presentation\Http\Requests\StoreProductRequest;
use Modules\Inventory\Products\Presentation\Http\Requests\UpdateProductRequest;
use Modules\Inventory\Products\Presentation\Http\Resources\ProductResource;
use Modules\Manufacturing\BillsOfMaterials\Domain\Services\ManufacturingAvailabilityService;
use Modules\MasterData\Categories\Domain\Models\Category;
use Throwable;

/**
 * Products CRUD endpoints. Controllers stay thin — behavior lives in actions,
 * validation in form requests, output shaping in resources.
 */
final class ProductController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListProductsAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'category_id' => $request->query('category_id'),
            'unit_id' => $request->query('unit_id'),
            'product_type' => $request->query('product_type'),
            'product_types' => $request->query('product_types'),
            'status' => $request->query('status', 'all'),
            'stock_status' => $request->query('stock_status'),
            'allow_negative' => $request->query('allow_negative'),
            'warehouse_id' => $request->query('warehouse_id'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
            'brand_id' => $request->query('brand_id'),
            'company_id' => $request->query('company_id'),  // resolves via brand.company_id
            'channel_id' => $request->query('channel_id'),
            'eligible_for_recipe' => $request->boolean('eligible_for_recipe'),
            'has_recipe' => $request->query('has_recipe'),
            'needs_pricing_review' => $request->boolean('needs_pricing_review'),
            'low_margin' => $request->boolean('low_margin'),
            'manufacturing_ready' => $request->boolean('manufacturing_ready'),
            'manufacturing_availability' => $request->query('manufacturing_availability'),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => ProductResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $product, GetProductAction $action, ManufacturingAvailabilityService $availabilityService): JsonResponse
    {
        $model = $action->execute($product)->data();

        if ($model->product_type === Product::TYPE_FINISHED_GOOD) {
            $result = $availabilityService->evaluate($model);
            $model->manufacturing_availability = $result['status'];
            $model->blocking_materials = $result['blocking_materials'];
            $model->recipe_components = $result['components'];
        }

        return $this->success(new ProductResource($model));
    }

    public function store(
        StoreProductRequest $request,
        CreateProductAction $action,
        MaterialCostService $costService,
    ): JsonResponse {
        $validated = $request->validated();

        [$productModel, $message] = DB::transaction(function () use ($request, $validated, $action): array {
            $result = $action->execute(ProductDTO::fromArray($validated));
            $productModel = $result->data();

            $manualCost = isset($validated['manual_cost']) && is_numeric($validated['manual_cost'])
                ? (float) $validated['manual_cost']
                : null;

            if ($manualCost !== null) {
                $productModel->update(['material_cost' => round($manualCost, 4)]);
            }

            $this->applyExtendedFields($request, $productModel, $validated);
            $this->syncChannels($productModel, $validated['channel_ids'] ?? []);

            return [$productModel, $result->message()];
        });

        $productModel->load(['category', 'unit', 'activeRecipe', 'channelMappings.channel.brand.company', 'brand.company']);

        return $this->created(new ProductResource($productModel), $message);
    }

    public function update(
        UpdateProductRequest $request,
        string $product,
        UpdateProductAction $action,
        MaterialCostService $costService,
        ManufacturingAvailabilityService $availabilityService,
    ): JsonResponse {
        $validated = $request->validated();

        // Load existing record once — used for both immutability guards and boolean preservation.
        $existing = Product::findOrFail($product);

        // brand_id is immutable once set; allow initial assignment if currently null.
        if ($existing->brand_id !== null) {
            $validated['brand_id'] = $existing->brand_id;
        }

        // Preserve optional boolean flags and cost_source that the product form does not expose.
        // Without this guard, ProductDTO defaults them to false/'purchase' on every save,
        // silently overwriting values set elsewhere (e.g. recipe eligibility toggle, patch endpoint).
        foreach (['can_manufacture', 'can_disassemble', 'allow_negative_stock'] as $flag) {
            if (! $request->has($flag)) {
                $validated[$flag] = (bool) $existing->{$flag};
            }
        }
        if (! $request->has('cost_source')) {
            $validated['cost_source'] = $existing->cost_source instanceof BackedEnum
                ? $existing->cost_source->value
                : (string) $existing->cost_source;
        }

        [$productModel, $message] = DB::transaction(function () use ($request, $product, $validated, $action, $costService): array {
            $result = $action->execute($product, ProductDTO::fromArray($validated));
            $productModel = $result->data();

            $this->applyExtendedFields($request, $productModel, $validated);

            $manualCost = isset($validated['manual_cost']) && is_numeric($validated['manual_cost'])
                ? (float) $validated['manual_cost']
                : null;

            if ($manualCost !== null) {
                $costService->update($productModel, $manualCost, CostUpdateSource::Manual);
                $productModel->refresh();
            }

            if (array_key_exists('channel_ids', $validated)) {
                $this->syncChannels($productModel, $validated['channel_ids'] ?? []);
            }

            return [$productModel, $result->message()];
        });

        $productModel->load(['category', 'unit', 'activeRecipe', 'channelMappings.channel.brand.company', 'brand.company']);

        if ($productModel->product_type === Product::TYPE_FINISHED_GOOD) {
            $result = $availabilityService->evaluate($productModel);
            $productModel->manufacturing_availability = $result['status'];
            $productModel->blocking_materials = $result['blocking_materials'];
            $productModel->recipe_components = $result['components'];
        }

        return $this->updated(new ProductResource($productModel), $message);
    }

    public function patch(
        PatchProductRequest $request,
        string $product,
        MaterialCostService $costService,
    ): JsonResponse {
        $model = Product::findOrFail($product);
        $validated = $request->validated();

        if (isset($validated['manual_cost'])) {
            $costService->update($model, (float) $validated['manual_cost'], CostUpdateSource::Manual);
            unset($validated['manual_cost']);
            $model->refresh();
        }

        $patchable = array_intersect_key($validated, array_flip(['is_active', 'stock_status', 'allow_negative_stock', 'regular_price', 'sale_price']));
        if ($patchable !== []) {
            $model->update($patchable);
        }

        $model->load(['category', 'unit', 'activeRecipe', 'channelMappings.channel.brand.company', 'brand.company']);

        return $this->updated(new ProductResource($model), 'Product updated.');
    }

    public function destroy(string $product, DeleteProductAction $action): JsonResponse
    {
        $result = $action->execute($product);

        return $this->deleted($result->message() ?? 'Product deleted successfully.');
    }

    public function stats(Request $request): JsonResponse
    {
        $companyId = $request->user()?->company_id;

        $query = Product::query()
            ->whereNull('deleted_at')
            ->whereHas('brand', fn ($q) => $q->where('company_id', $companyId));

        // ── Product type scope ────────────────────────────────────────────────
        $productTypes = trim((string) ($request->query('product_types') ?? ''));
        $productType = trim((string) ($request->query('product_type') ?? ''));

        if ($productTypes !== '') {
            $validTypes = array_values(array_filter(
                array_map('trim', explode(',', $productTypes)),
                fn (string $t) => in_array($t, Product::TYPES, true),
            ));
            $query->whereIn('product_type', $validTypes !== [] ? $validTypes : ['raw_material', 'packaging_material']);
        } elseif ($productType !== '' && in_array($productType, Product::TYPES, true)) {
            $query->where('product_type', $productType);
        } else {
            $query->whereIn('product_type', ['raw_material', 'packaging_material']);
        }

        $categoryId = trim((string) ($request->query('category_id') ?? ''));
        if ($categoryId !== '') {
            $query->where('category_id', $categoryId);
        }

        $warehouseId = trim((string) ($request->query('warehouse_id') ?? ''));

        // Canonical inventory summary flag (EPIC-DATA-CONSOLIDATION-001, Phase B/D).
        // OFF (default): legacy sum-then-clamp + material_cost — byte-identical.
        // ON: canonical clamp-per-warehouse-then-sum + FIFO value.
        $canonicalSummary = (bool) config('inventory_ledger.canonical_summary');

        $inventorySubquery = DB::table('inventory_items')
            ->whereNull('deleted_at')
            ->selectRaw('product_id, SUM(on_hand_qty) as inv_on_hand, SUM(reserved_qty) as inv_reserved, SUM(GREATEST(on_hand_qty - reserved_qty, 0)) as inv_available')
            ->groupBy('product_id');

        if ($warehouseId !== '') {
            $inventorySubquery->where('warehouse_id', $warehouseId);
        }

        $totalAvailableExpr = $canonicalSummary
            ? 'COALESCE(SUM(inv_agg.inv_available), 0)'
            : 'GREATEST(COALESCE(SUM(inv_agg.inv_on_hand), 0) - COALESCE(SUM(inv_agg.inv_reserved), 0), 0)';

        $totalValueExpr = $canonicalSummary
            ? 'COALESCE(SUM(COALESCE(fifo_agg.fifo_value, 0)), 0)'
            : 'COALESCE(SUM(inv_agg.inv_on_hand * COALESCE(products.material_cost, 0)), 0)';

        $query->leftJoinSub($inventorySubquery, 'inv_agg', 'products.id', '=', 'inv_agg.product_id');

        if ($canonicalSummary) {
            $fifoSubquery = DB::table('inventory_receipt_layers')
                ->where('remaining_qty', '>', 0)
                ->selectRaw('product_id, SUM(remaining_qty * landed_unit_cost) as fifo_value')
                ->groupBy('product_id');
            $query->leftJoinSub($fifoSubquery, 'fifo_agg', 'products.id', '=', 'fifo_agg.product_id');
        }

        $result = $query
            ->selectRaw("
                COUNT(*) as total_count,
                COALESCE(SUM(inv_agg.inv_on_hand), 0) as total_on_hand,
                COALESCE(SUM(inv_agg.inv_reserved), 0) as total_reserved,
                {$totalAvailableExpr} as total_available,
                {$totalValueExpr} as total_inventory_value
            ")
            ->first();

        return $this->success([
            'total_count' => (int) ($result->total_count ?? 0),
            'total_on_hand' => (float) ($result->total_on_hand ?? 0),
            'total_reserved' => (float) ($result->total_reserved ?? 0),
            'total_available' => (float) ($result->total_available ?? 0),
            'total_inventory_value' => (float) ($result->total_inventory_value ?? 0),
        ]);
    }

    public function nextSku(Request $request): JsonResponse
    {
        $prefix = strtoupper(trim((string) $request->query('prefix', 'RM')));
        $companyId = $request->user()?->company_id;

        $last = Product::query()
            ->whereHas('brand', fn ($q) => $q->where('company_id', $companyId))
            ->where('sku', 'like', "{$prefix}-%")
            ->orderByRaw('CAST(SUBSTRING(sku, '.(strlen($prefix) + 2).') AS UNSIGNED) DESC')
            ->value('sku');

        $nextNum = 1;
        if ($last !== null) {
            $numPart = (int) substr($last, strlen($prefix) + 1);
            $nextNum = $numPart + 1;
        }

        return $this->success(['sku' => $prefix.'-'.str_pad((string) $nextNum, 6, '0', STR_PAD_LEFT)]);
    }

    /**
     * Import products from a CSV file.
     * Rows with duplicate SKUs are updated; new SKUs are created.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        $handle = fopen($request->file('file')->getPathname(), 'r');
        $headers = fgetcsv($handle);

        if ($headers === false || $headers === null) {
            fclose($handle);

            return $this->error('The CSV file is empty or has no header row.', 422);
        }

        $headers = array_map('trim', $headers);
        $required = ['sku', 'name', 'product_type'];
        $missingCols = array_diff($required, $headers);

        if ($missingCols !== []) {
            fclose($handle);

            return $this->error('Missing required columns: '.implode(', ', $missingCols), 422);
        }

        $successCount = 0;
        $errors = [];
        $rowNum = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNum++;

            if (count($row) !== count($headers)) {
                $errors[] = ['row' => $rowNum, 'message' => 'Column count mismatch.'];

                continue;
            }

            $data = array_combine($headers, $row);

            $isMaterialRow = in_array(trim($data['product_type'] ?? ''), ['raw_material', 'packaging_material'], true);
            $validation = Validator::make($data, [
                'sku' => ['required', 'string', 'max:100'],
                'name' => ['required', 'string', 'max:255'],
                'product_type' => ['required', 'string', 'in:finished_good,raw_material,packaging_material'],
                'brand_id' => $isMaterialRow
                    ? ['nullable', 'uuid', 'exists:brands,id']
                    : ['required', 'uuid', 'exists:brands,id'],
            ]);

            if ($validation->fails()) {
                $errors[] = ['row' => $rowNum, 'message' => implode('; ', $validation->errors()->all())];

                continue;
            }

            try {
                $sku = trim($data['sku']);
                $categoryId = null;

                if (! empty($data['category_name'])) {
                    $cat = Category::query()
                        ->where('name', trim($data['category_name']))
                        ->value('id');
                    $categoryId = $cat;
                }

                $payload = array_filter([
                    'brand_id' => trim($data['brand_id']),
                    'name' => trim($data['name']),
                    'product_type' => trim($data['product_type']),
                    'category_id' => $categoryId,
                    'regular_price' => isset($data['regular_price']) && is_numeric($data['regular_price'])
                        ? (float) $data['regular_price'] : null,
                    'sale_price' => isset($data['sale_price']) && is_numeric($data['sale_price'])
                        ? (float) $data['sale_price'] : null,
                    'stock_status' => isset($data['stock_status']) && in_array($data['stock_status'], ['instock', 'outofstock', 'onbackorder'])
                        ? $data['stock_status'] : null,
                    'is_active' => true,
                ], fn ($v) => $v !== null);

                $existing = Product::query()->where('sku', $sku)->whereNull('deleted_at')->first();

                if ($existing) {
                    $existing->update($payload);
                } else {
                    Product::create(array_merge($payload, ['sku' => $sku]));
                }

                $successCount++;
            } catch (Throwable $e) {
                $errors[] = ['row' => $rowNum, 'message' => $e->getMessage()];
            }
        }

        fclose($handle);

        return $this->success([
            'success' => $successCount,
            'errors' => $errors,
        ]);
    }

    /**
     * Apply pricing and content fields that are not carried by ProductDTO.
     * Only updates fields that were actually present in the request.
     *
     * @param  array<string, mixed>  $validated
     */
    private function applyExtendedFields(
        Request $request,
        Product $product,
        array $validated,
    ): void {
        $fields = [
            'regular_price', 'sale_price', 'short_description', 'long_description', 'stock_status',
            'pricing_mode', 'custom_target_margin', 'custom_markup', 'custom_discount_pct',
        ];
        $extra = [];

        foreach ($fields as $field) {
            if ($request->has($field)) {
                $extra[$field] = $validated[$field] ?? null;
            }
        }

        if ($extra !== []) {
            $product->update($extra);
        }
    }

    /**
     * Replace channel mappings for a product.
     *
     * Brand ownership rule: all assigned channels must belong to the product's brand.
     * Cross-brand assignments are rejected with a 422 before any write occurs.
     *
     * The table has UNIQUE(product_id, channel_id) with soft-deletes, so a removed
     * mapping stays as a soft-deleted row. Re-adding must restore that row rather than
     * INSERT a new one — otherwise the unique constraint fires and the save crashes.
     *
     * @param  string[]  $channelIds
     */
    private function syncChannels(Product $product, ?array $channelIds): void
    {
        if ($channelIds === null) {
            return;
        }

        // Reject any channel that belongs to a different brand.
        if ($product->brand_id !== null && $channelIds !== []) {
            $wrongBrand = \Modules\Commerce\Channels\Domain\Models\Channel::query()
                ->whereIn('id', $channelIds)
                ->where('brand_id', '!=', $product->brand_id)
                ->pluck('name')
                ->toArray();

            if ($wrongBrand !== []) {
                abort(422, 'Cross-brand channel assignment is prohibited. Channels not belonging to this product\'s brand: '.implode(', ', $wrongBrand));
            }
        }

        $existing = ProductMapping::where('product_id', $product->id)
            ->pluck('channel_id')
            ->toArray();

        $toAdd = array_diff($channelIds, $existing);
        $toRemove = array_diff($existing, $channelIds);

        foreach ($toAdd as $channelId) {
            // deleted_at is not in ProductMapping::$fillable, so updateOrCreate cannot
            // restore a soft-deleted row via mass-assignment. Use explicit restore instead.
            $existing = ProductMapping::withTrashed()
                ->where('product_id', $product->id)
                ->where('channel_id', $channelId)
                ->first();

            if ($existing !== null) {
                if ($existing->trashed()) {
                    $existing->restore();
                }
                $existing->update([
                    'external_product_id' => '',
                    'sync_status' => SyncStatus::Pending->value,
                ]);
            } else {
                ProductMapping::create([
                    'product_id' => $product->id,
                    'channel_id' => $channelId,
                    'external_product_id' => '',
                    'sync_status' => SyncStatus::Pending->value,
                ]);
            }
        }

        if ($toRemove !== []) {
            ProductMapping::where('product_id', $product->id)
                ->whereIn('channel_id', $toRemove)
                ->delete();
        }
    }
}
