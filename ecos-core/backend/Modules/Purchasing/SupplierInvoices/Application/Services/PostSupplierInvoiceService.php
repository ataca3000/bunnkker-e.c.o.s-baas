<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierInvoices\Application\Services;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\CostManagement\Domain\Enums\CostUpdateSource;
use Modules\CostManagement\Domain\Services\EnterpriseCostEngine;
use Modules\CostManagement\Domain\Services\MaterialCostService;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Inventory\StockLedger\Domain\Enums\MovementType;
use Modules\Inventory\StockLedger\Domain\Models\StockMovement;
use Modules\Purchasing\SupplierInvoices\Domain\Enums\SupplierInvoiceStatus;
use Modules\Purchasing\SupplierInvoices\Domain\Models\SupplierInvoice;
use Modules\Purchasing\SupplierInvoices\Domain\Models\SupplierInvoiceLine;
use RuntimeException;
use Throwable;

/**
 * ADR-011 Mode 3: Supplier Invoice → Auto-posting → Inventory.
 *
 * Validates the invoice, allocates landed costs, creates FIFO receipt layers,
 * updates stock balances, fires stock movements, and updates product cost data.
 * All steps run inside a single DB transaction; any failure rolls back cleanly.
 */
final class PostSupplierInvoiceService
{
    public function __construct(
        private readonly MaterialCostService $materialCostService,
    ) {}

    public function execute(SupplierInvoice $invoice): void
    {
        if (! $invoice->status->canPost()) {
            throw new RuntimeException("Invoice {$invoice->invoice_number} cannot be posted (status: {$invoice->status->value}).");
        }

        DB::transaction(function () use ($invoice): void {
            $log = [];

            $invoice->update([
                'status' => SupplierInvoiceStatus::AutoProcessing,
                'processing_started_at' => now(),
                'posting_log' => [],
                'posting_error' => null,
            ]);

            try {
                // Step 1 — Load lines eagerly
                $invoice->load(['lines.product', 'supplier', 'warehouse']);
                $log[] = '[1/8] Lines loaded: '.$invoice->lines->count().' item(s)';

                // Step 2 — Allocate landed costs proportionally across lines
                $this->allocateLandedCosts($invoice);
                $log[] = '[2/8] Landed costs allocated (freight + additional)';

                // Steps 3 + 4 — Batch: snapshot pre-receipt qtys and update inventory
                // Single batched lockForUpdate query replaces 2N individual InventoryItem lookups.
                $preQtys = $this->captureAndUpdateInventory($invoice);
                $log[] = '[3/8] Pre-receipt inventory snapshot captured';
                $log[] = '[4/8] Inventory quantities updated';

                // Step 5 — Create FIFO receipt layers
                $this->createReceiptLayers($invoice, $preQtys);
                $log[] = '[5/8] FIFO receipt layers created';

                // Step 6 — Write stock movement ledger entries
                $this->createStockMovements($invoice, $preQtys);
                $log[] = '[6/8] Stock ledger movements recorded';

                // Step 7 — Update product cost intelligence (batched FIFO layer lookup)
                $this->updateProductCosts($invoice, $preQtys);
                $log[] = '[7/8] Product cost intelligence updated';

                // Step 8 — Mark posted
                $invoice->update([
                    'status' => SupplierInvoiceStatus::Posted,
                    'posted_by' => Auth::id(),
                    'posted_at' => now(),
                    'posting_log' => $log,
                ]);
                $log[] = '[8/8] Invoice posted successfully';

            } catch (Throwable $e) {
                $invoice->update([
                    'status' => SupplierInvoiceStatus::Failed,
                    'posting_error' => $e->getMessage(),
                    'posting_log' => $log,
                ]);
                throw $e;
            }
        });
    }

    private function allocateLandedCosts(SupplierInvoice $invoice): void
    {
        $totalSubtotal = (float) $invoice->subtotal;

        if ($totalSubtotal <= 0) {
            return;
        }

        $freight = (float) $invoice->freight_amount;
        $additional = (float) $invoice->additional_costs;

        foreach ($invoice->lines as $line) {
            /** @var SupplierInvoiceLine $line */
            $ratio = (float) $line->line_total / $totalSubtotal;
            $allocFrt = round($freight * $ratio, 4);
            $allocAdd = round($additional * $ratio, 4);
            $landed = round(((float) $line->unit_price + ($allocFrt + $allocAdd) / max((float) $line->quantity, 1)), 4);

            $line->update([
                'allocated_freight' => $allocFrt,
                'allocated_additional_costs' => $allocAdd,
                'landed_unit_cost' => $landed,
            ]);
        }
    }

    /**
     * Steps 3 + 4 combined.
     *
     * One batch query with pessimistic lock replaces 2N individual InventoryItem
     * lookups (N for the pre-qty snapshot + N for the locked increment).
     *
     * @return array<string, float> product_id → on_hand_qty BEFORE this receipt
     */
    private function captureAndUpdateInventory(SupplierInvoice $invoice): array
    {
        $activeLines = $invoice->lines->filter(fn ($l) => (float) $l->quantity > 0);

        if ($activeLines->isEmpty()) {
            return [];
        }

        $productIds = $activeLines->pluck('product_id')->unique()->values()->all();

        // Single batch query with lock for all relevant InventoryItems
        $existingItems = InventoryItem::query()
            ->whereIn('product_id', $productIds)
            ->where('warehouse_id', $invoice->warehouse_id)
            ->lockForUpdate()
            ->get()
            ->keyBy('product_id');

        // Build pre-qty map (was Step 3)
        $preQtys = [];
        foreach ($activeLines as $line) {
            $item = $existingItems->get($line->product_id);
            $preQtys[$line->product_id] = $item ? (float) $item->on_hand_qty : 0.0;
        }

        // Update inventory (was Step 4)
        foreach ($activeLines as $line) {
            $qty = (float) $line->quantity;
            $item = $existingItems->get($line->product_id);

            if ($item === null) {
                $newItem = InventoryItem::query()->create([
                    'product_id' => $line->product_id,
                    'warehouse_id' => $invoice->warehouse_id,
                    'company_id' => $invoice->warehouse?->company_id,
                    'on_hand_qty' => $qty,
                    'reserved_qty' => 0,
                ]);
                // Track in-memory so duplicate lines for the same product increment correctly
                $existingItems->put($line->product_id, $newItem);
            } else {
                $item->increment('on_hand_qty', $qty);
            }
        }

        return $preQtys;
    }

    /** @param array<string, float> $preQtys */
    private function createReceiptLayers(SupplierInvoice $invoice, array $preQtys): void
    {
        $receiptDate = $invoice->invoice_date->toDateString();

        foreach ($invoice->lines as $line) {
            $netQty = (float) $line->quantity;
            $landedCost = (float) ($line->landed_unit_cost ?? $line->unit_price);

            if ($netQty <= 0 || $landedCost <= 0) {
                continue;
            }

            $product = $line->product;
            $salePriceSnapshot = $product ? (float) ($product->sale_price ?? 0) : null;

            InventoryReceiptLayer::query()->create([
                'supplier_id' => $invoice->supplier_id,
                'product_id' => $line->product_id,
                'goods_receipt_id' => null,
                'goods_receipt_line_id' => null,
                'warehouse_id' => $invoice->warehouse_id,
                'received_qty' => $netQty,
                'remaining_qty' => $netQty,
                'landed_unit_cost' => $landedCost,
                'sale_price_snapshot' => $salePriceSnapshot > 0 ? $salePriceSnapshot : null,
                'receipt_date' => $receiptDate,
            ]);
        }
    }

    /** @param array<string, float> $preQtys */
    private function createStockMovements(SupplierInvoice $invoice, array $preQtys): void
    {
        $movementDate = $invoice->invoice_date->toDateString();

        foreach ($invoice->lines as $line) {
            $qty = (float) $line->quantity;
            if ($qty <= 0) {
                continue;
            }

            $before = $preQtys[$line->product_id] ?? 0.0;
            $after = $before + $qty;

            StockMovement::query()->create([
                'warehouse_id' => $invoice->warehouse_id,
                'product_id' => $line->product_id,
                'movement_type' => MovementType::PurchaseReceipt,
                'quantity' => $qty,
                'balance_before' => $before,
                'balance_after' => $after,
                'reference_type' => SupplierInvoice::class,
                'reference_id' => $invoice->id,
                'movement_date' => $movementDate,
                'notes' => "Supplier Invoice {$invoice->invoice_number}",
            ]);
        }
    }

    /** @param array<string, float> $preQtys */
    private function updateProductCosts(SupplierInvoice $invoice, array $preQtys): void
    {
        $receiptDate = $invoice->invoice_date->toDateString();

        $activeLines = $invoice->lines->filter(
            fn ($line) => $line->product !== null
                && (float) $line->quantity > 0
                && (float) ($line->landed_unit_cost ?? $line->unit_price) > 0,
        );

        if ($activeLines->isEmpty()) {
            return;
        }

        // Batch-fetch oldest open FIFO layer per product — 1 query replaces N
        $productIds = $activeLines->pluck('product_id')->unique()->values()->all();
        $oldestLayers = InventoryReceiptLayer::query()
            ->whereIn('product_id', $productIds)
            ->where('remaining_qty', '>', 0)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->groupBy('product_id')
            ->map(fn ($layers) => $layers->first());

        foreach ($activeLines as $line) {
            $product = $line->product;
            $netQty = (float) $line->quantity;
            $landedCost = (float) ($line->landed_unit_cost ?? $line->unit_price);

            $oldQty = $preQtys[$line->product_id] ?? 0.0;
            $oldAvg = (float) ($product->average_cost ?? $landedCost);
            // Canonical weighted-average — single definition on EnterpriseCostEngine.
            $newAvgCost = EnterpriseCostEngine::weightedAverageCost($oldQty, $oldAvg, $netQty, $landedCost);

            $oldestLayer = $oldestLayers->get($line->product_id);

            $product->update([
                'last_purchase_cost' => $landedCost,
                'average_cost' => $newAvgCost,
                'last_purchase_date' => $receiptDate,
                'last_supplier_id' => $invoice->supplier_id,
                'current_fifo_cost' => $oldestLayer?->landed_unit_cost ?? $landedCost,
            ]);

            $this->materialCostService->update(
                material: $product,
                newCost: $landedCost,
                source: CostUpdateSource::PurchaseInvoice,
                meta: ['supplier_invoice_id' => $invoice->id],
            );
        }
    }
}
