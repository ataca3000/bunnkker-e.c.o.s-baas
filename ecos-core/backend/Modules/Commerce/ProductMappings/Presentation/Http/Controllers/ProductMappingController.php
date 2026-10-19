<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Commerce\ProductMappings\Application\Actions\CreateProductMappingAction;
use Modules\Commerce\ProductMappings\Application\Actions\DeleteProductMappingAction;
use Modules\Commerce\ProductMappings\Application\Actions\GetProductMappingAction;
use Modules\Commerce\ProductMappings\Application\Actions\ListProductMappingsAction;
use Modules\Commerce\ProductMappings\Application\Actions\UpdateProductMappingAction;
use Modules\Commerce\ProductMappings\Application\DTO\ProductMappingDTO;
use Modules\Commerce\ProductMappings\Presentation\Http\Requests\StoreProductMappingRequest;
use Modules\Commerce\ProductMappings\Presentation\Http\Requests\UpdateProductMappingRequest;
use Modules\Commerce\ProductMappings\Presentation\Http\Resources\ProductMappingResource;

final class ProductMappingController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListProductMappingsAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'product_id' => $request->query('product_id'),
            'channel_id' => $request->query('channel_id'),
            'sync_status' => $request->query('sync_status'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => ProductMappingResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $productMapping, GetProductMappingAction $action): JsonResponse
    {
        $model = $action->execute($productMapping)->data();

        return $this->success(new ProductMappingResource($model));
    }

    public function store(StoreProductMappingRequest $request, CreateProductMappingAction $action): JsonResponse
    {
        $result = $action->execute(ProductMappingDTO::fromArray($request->validated()));

        return $this->created(new ProductMappingResource($result->data()), $result->message());
    }

    public function update(
        UpdateProductMappingRequest $request,
        string $productMapping,
        UpdateProductMappingAction $action,
    ): JsonResponse {
        $result = $action->execute($productMapping, ProductMappingDTO::fromArray($request->validated()));

        return $this->updated(new ProductMappingResource($result->data()), $result->message());
    }

    public function destroy(string $productMapping, DeleteProductMappingAction $action): JsonResponse
    {
        $result = $action->execute($productMapping);

        return $this->deleted($result->message() ?? 'Product mapping deleted successfully.');
    }
}
