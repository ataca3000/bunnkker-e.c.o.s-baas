<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Purchasing\Suppliers\Application\Actions\CreateSupplierAction;
use Modules\Purchasing\Suppliers\Application\Actions\DeleteSupplierAction;
use Modules\Purchasing\Suppliers\Application\Actions\GetSupplierAction;
use Modules\Purchasing\Suppliers\Application\Actions\ListSuppliersAction;
use Modules\Purchasing\Suppliers\Application\Actions\UpdateSupplierAction;
use Modules\Purchasing\Suppliers\Application\DTO\SupplierDTO;
use Modules\Purchasing\Suppliers\Presentation\Http\Requests\StoreSupplierRequest;
use Modules\Purchasing\Suppliers\Presentation\Http\Requests\UpdateSupplierRequest;
use Modules\Purchasing\Suppliers\Presentation\Http\Resources\SupplierResource;

/**
 * Suppliers CRUD endpoints. Controllers stay thin — behavior lives in actions,
 * validation in form requests, output shaping in resources.
 */
final class SupplierController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListSuppliersAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'status' => $request->query('status', 'all'),
            'country' => $request->query('country'),
            'city' => $request->query('city'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => SupplierResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $supplier, GetSupplierAction $action): JsonResponse
    {
        $model = $action->execute($supplier)->data();

        return $this->success(new SupplierResource($model));
    }

    public function store(StoreSupplierRequest $request, CreateSupplierAction $action): JsonResponse
    {
        $result = $action->execute(SupplierDTO::fromArray($request->validated()));

        return $this->created(new SupplierResource($result->data()), $result->message());
    }

    public function update(
        UpdateSupplierRequest $request,
        string $supplier,
        UpdateSupplierAction $action,
    ): JsonResponse {
        $result = $action->execute($supplier, SupplierDTO::fromArray($request->validated()));

        return $this->updated(new SupplierResource($result->data()), $result->message());
    }

    public function destroy(string $supplier, DeleteSupplierAction $action): JsonResponse
    {
        $result = $action->execute($supplier);

        return $this->deleted($result->message() ?? 'Supplier deleted successfully.');
    }
}
