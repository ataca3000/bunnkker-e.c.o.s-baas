<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\CostManagement\Domain\Models\RecipeCostHistory;
use Modules\Manufacturing\BillsOfMaterials\Application\Actions\CreateBomAction;
use Modules\Manufacturing\BillsOfMaterials\Application\Actions\DeleteBomAction;
use Modules\Manufacturing\BillsOfMaterials\Application\Actions\GetBomAction;
use Modules\Manufacturing\BillsOfMaterials\Application\Actions\ListBomsAction;
use Modules\Manufacturing\BillsOfMaterials\Application\Actions\SetBomStatusAction;
use Modules\Manufacturing\BillsOfMaterials\Application\Actions\UpdateBomAction;
use Modules\Manufacturing\BillsOfMaterials\Application\DTO\BomDTO;
use Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\BomNotFoundException;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;
use Modules\Manufacturing\BillsOfMaterials\Presentation\Http\Requests\SetBomStatusRequest;
use Modules\Manufacturing\BillsOfMaterials\Presentation\Http\Requests\StoreBomRequest;
use Modules\Manufacturing\BillsOfMaterials\Presentation\Http\Requests\UpdateBomRequest;
use Modules\Manufacturing\BillsOfMaterials\Presentation\Http\Resources\BomResource;

final class BomController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListBomsAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'product_id' => $request->query('product_id'),
            'company_id' => $request->query('company_id'),
            'channel_id' => $request->query('channel_id'),
            'is_active' => match ($request->query('status', 'all')) {
                'active' => true,
                'draft' => false,
                default => 'all',
            },
            'has_manufacturing_cost' => $request->boolean('has_manufacturing_cost'),
            'has_packaging_materials' => $request->boolean('has_packaging_materials'),
            'updated_from' => $request->query('updated_from'),
            'updated_to' => $request->query('updated_to'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 20),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => BomResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $bom, GetBomAction $action): JsonResponse
    {
        try {
            $model = $action->execute($bom)->data();
        } catch (BomNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }

        return $this->success(new BomResource($model));
    }

    public function store(StoreBomRequest $request, CreateBomAction $action): JsonResponse
    {
        $result = $action->execute(BomDTO::fromArray($request->validated()));

        return $this->created(new BomResource($result->data()), $result->message());
    }

    /**
     * Activate or deactivate a recipe without touching its structure.
     *
     * Deliberately separate from update(): the status payload has no `lines`
     * field, so BUG-BOM-DATA-LOSS-001 cannot recur through this path.
     */
    public function setStatus(
        SetBomStatusRequest $request,
        BillOfMaterial $bom,
        SetBomStatusAction $action,
    ): JsonResponse {
        $result = $action->execute($bom, $request->boolean('is_active'));

        return $this->updated(new BomResource($result->data()), $result->message());
    }

    public function update(
        UpdateBomRequest $request,
        BillOfMaterial $bom,
        UpdateBomAction $action,
    ): JsonResponse {
        $result = $action->execute($bom, BomDTO::fromArray($request->validated()));

        return $this->updated(new BomResource($result->data()), $result->message());
    }

    public function destroy(BillOfMaterial $bom, DeleteBomAction $action): JsonResponse
    {
        $result = $action->execute($bom);

        if ($result->isFailure()) {
            return $this->error($result->message() ?? 'Cannot delete this Bill of Materials.', 422);
        }

        return $this->deleted($result->message() ?? 'Bill of Materials deleted successfully.');
    }

    public function costHistory(Request $request, BillOfMaterial $bom): JsonResponse
    {
        $perPage = min((int) $request->query('per_page', 20), 100);

        $paginator = RecipeCostHistory::query()
            ->where('bom_id', $bom->id)
            ->orderByDesc('occurred_at')
            ->paginate($perPage);

        return $this->success([
            'items' => $paginator->map(fn (RecipeCostHistory $h): array => [
                'id' => $h->id,
                'previous_materials_cost' => $h->previous_materials_cost,
                'new_materials_cost' => $h->new_materials_cost,
                'difference' => $h->difference,
                'trigger_type' => $h->trigger_type,
                'trigger_source' => $h->trigger_source,
                'triggered_by' => $h->triggered_by,
                'has_missing_costs' => (bool) ($h->cost_snapshot['has_missing_costs'] ?? false),
                'occurred_at' => $h->occurred_at?->toIso8601String(),
            ])->values()->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
