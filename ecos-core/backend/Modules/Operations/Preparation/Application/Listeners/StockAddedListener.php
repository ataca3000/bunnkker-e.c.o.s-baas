<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Listeners;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\Inventory\DomainEvents\Events\InventoryStockReceived;
use Throwable;

/**
 * When raw material stock arrives, check if any shortage-blocked waves
 * now have their shortages resolved. If so, log and let the planner decide.
 *
 * INTEGRATION-DESIGN.md §5.2
 */
final class StockAddedListener
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function handle(InventoryStockReceived $event): void
    {
        if ($this->flags->isDisabled('workflow.stages.preparation', $event->companyId)) {
            return;
        }

        try {
            $unresolved = DB::table('preparation_material_requirements as pmr')
                ->join('preparation_waves as pw', 'pw.id', '=', 'pmr.preparation_wave_id')
                ->where('pw.status', 'shortage_blocked')
                ->where('pw.company_id', $event->companyId)
                ->where('pw.warehouse_id', $event->warehouseId)
                ->where('pmr.raw_material_id', $event->productId)
                ->where('pmr.shortage', true)
                ->where('pmr.resolved', false)
                ->select('pmr.id', 'pmr.preparation_wave_id', 'pmr.quantity_required', 'pw.wave_number')
                ->get();

            foreach ($unresolved as $req) {
                $currentStock = DB::table('inventory_items')
                    ->where('product_id', $event->productId)
                    ->where('warehouse_id', $event->warehouseId)
                    ->sum('on_hand_quantity');

                if ($currentStock >= $req->quantity_required) {
                    DB::table('preparation_material_requirements')
                        ->where('id', $req->id)
                        ->update(['resolved' => true, 'updated_at' => now()]);

                    Log::channel('daily')->info('[Preparation] Shortage resolved by stock arrival', [
                        'wave_number' => $req->wave_number,
                        'wave_id' => $req->preparation_wave_id,
                        'material_id' => $event->productId,
                        'stock_arrived' => $event->quantityReceived,
                        'stock_on_hand' => $currentStock,
                        'qty_required' => $req->quantity_required,
                    ]);
                }
            }
        } catch (Throwable $e) {
            Log::channel('daily')->error('[Preparation] StockAddedListener failed', [
                'product_id' => $event->productId,
                'warehouse_id' => $event->warehouseId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
