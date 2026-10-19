<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\MasterData\Units\Application\Actions\CreateUnitAction;
use Modules\MasterData\Units\Application\Actions\DeleteUnitAction;
use Modules\MasterData\Units\Application\Actions\GetUnitAction;
use Modules\MasterData\Units\Application\Actions\ListUnitsAction;
use Modules\MasterData\Units\Application\Actions\UpdateUnitAction;
use Modules\MasterData\Units\Application\DTO\UnitDTO;
use Modules\MasterData\Units\Presentation\Http\Requests\StoreUnitRequest;
use Modules\MasterData\Units\Presentation\Http\Requests\UpdateUnitRequest;
use Modules\MasterData\Units\Presentation\Http\Resources\UnitResource;

/**
 * Units of measure CRUD endpoints. Controllers stay thin — behavior lives in
 * actions, validation in form requests, output shaping in resources.
 */
final class UnitController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListUnitsAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'status' => $request->query('status', 'all'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => UnitResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $unit, GetUnitAction $action): JsonResponse
    {
        $model = $action->execute($unit)->data();

        return $this->success(new UnitResource($model));
    }

    public function store(StoreUnitRequest $request, CreateUnitAction $action): JsonResponse
    {
        $result = $action->execute(UnitDTO::fromArray($request->validated()));

        return $this->created(new UnitResource($result->data()), $result->message());
    }

    public function update(
        UpdateUnitRequest $request,
        string $unit,
        UpdateUnitAction $action,
    ): JsonResponse {
        $result = $action->execute($unit, UnitDTO::fromArray($request->validated()));

        return $this->updated(new UnitResource($result->data()), $result->message());
    }

    public function destroy(string $unit, DeleteUnitAction $action): JsonResponse
    {
        $result = $action->execute($unit);

        return $this->deleted($result->message() ?? 'Unit deleted successfully.');
    }
}
