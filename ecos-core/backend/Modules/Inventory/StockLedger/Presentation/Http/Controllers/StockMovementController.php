<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\StockLedger\Application\Actions\AddManualStockAction;
use Modules\Inventory\StockLedger\Application\Actions\GetStockMovementAction;
use Modules\Inventory\StockLedger\Application\Actions\ListStockMovementsAction;
use Modules\Inventory\StockLedger\Infrastructure\Adapters\LedgerCompatibilityReader;
use Modules\Inventory\StockLedger\Presentation\Http\Resources\StockMovementResource;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;

final class StockMovementController extends Controller
{
    use HasApiResponse;

    public function index(
        Request $request,
        ListStockMovementsAction $action,
        LedgerCompatibilityReader $ledgerReader,
    ): JsonResponse {
        $filters = [
            'search' => $request->query('search'),
            'product_id' => $request->query('product_id'),
            'warehouse_id' => $request->query('warehouse_id'),
            'movement_type' => $request->query('movement_type', 'all'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ];

        // Phase A gradual migration: canonical ledger reads behind a default-off flag.
        // Both paths return the identical JSON contract.
        if (config('inventory_ledger.canonical_reads')) {
            $paginator = $ledgerReader->paginate($filters);

            return $this->success([
                'items' => $paginator->items(), // already in movement shape
                'meta' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => $paginator->lastPage(),
                ],
            ]);
        }

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => StockMovementResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(Request $request, AddManualStockAction $action): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'uuid', 'exists:products,id'],
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $product = Product::findOrFail($validated['product_id']);
        $warehouse = Warehouse::findOrFail($validated['warehouse_id']);

        $movement = $action->execute(
            $product,
            $warehouse,
            (float) $validated['quantity'],
            [
                'unit_cost' => $validated['unit_cost'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'updated_by' => $request->user()?->name,
            ],
        )->data();

        return $this->success(new StockMovementResource($movement), 'Created', 201);
    }

    public function show(string $stockMovement, GetStockMovementAction $action): JsonResponse
    {
        $model = $action->execute($stockMovement)->data();

        return $this->success(new StockMovementResource($model));
    }
}
