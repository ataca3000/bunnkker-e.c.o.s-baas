<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\MasterData\Warehouses\Application\Actions\CreateWarehouseAction;
use Modules\MasterData\Warehouses\Application\Actions\DeleteWarehouseAction;
use Modules\MasterData\Warehouses\Application\Actions\GetWarehouseAction;
use Modules\MasterData\Warehouses\Application\Actions\ListWarehousesAction;
use Modules\MasterData\Warehouses\Application\Actions\UpdateWarehouseAction;
use Modules\MasterData\Warehouses\Application\DTO\WarehouseDTO;
use Modules\MasterData\Warehouses\Presentation\Http\Requests\StoreWarehouseRequest;
use Modules\MasterData\Warehouses\Presentation\Http\Requests\UpdateWarehouseRequest;
use Modules\MasterData\Warehouses\Presentation\Http\Resources\WarehouseResource;

/**
 * Warehouses CRUD endpoints. Controllers stay thin — behavior lives in actions,
 * validation in form requests, output shaping in resources.
 */
final class WarehouseController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListWarehousesAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'company_id' => (string) (Auth::user()?->company_id ?? ''),
            'status' => $request->query('status', 'all'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => WarehouseResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $warehouse, GetWarehouseAction $action): JsonResponse
    {
        $model = $action->execute($warehouse)->data();

        return $this->success(new WarehouseResource($model));
    }

    public function store(StoreWarehouseRequest $request, CreateWarehouseAction $action): JsonResponse
    {
        $result = $action->execute(WarehouseDTO::fromArray($request->validated()));

        return $this->created(new WarehouseResource($result->data()), $result->message());
    }

    public function update(
        UpdateWarehouseRequest $request,
        string $warehouse,
        UpdateWarehouseAction $action,
    ): JsonResponse {
        $result = $action->execute($warehouse, WarehouseDTO::fromArray($request->validated()));

        return $this->updated(new WarehouseResource($result->data()), $result->message());
    }

    public function destroy(string $warehouse, DeleteWarehouseAction $action): JsonResponse
    {
        $result = $action->execute($warehouse);

        return $this->deleted($result->message() ?? 'Warehouse deleted successfully.');
    }
}
