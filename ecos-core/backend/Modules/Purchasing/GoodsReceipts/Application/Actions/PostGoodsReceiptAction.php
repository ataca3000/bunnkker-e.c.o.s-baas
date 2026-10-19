<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\InventoryItems\Application\Actions\ReceiveStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\ReceiptLayers\Application\Actions\CreateReceiptLayersAction;
use Modules\Purchasing\GoodsReceipts\Domain\Contracts\GoodsReceiptRepositoryInterface;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\EmptyGoodsReceiptException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\GoodsReceiptAlreadyPostedException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\GoodsReceiptNotFoundException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\OverReceiptException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\PurchaseOrderCancelledException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\PurchaseOrderClosedException;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\InvalidPurchaseOrderStatusException;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;

/**
 * Posts a Goods Receipt, triggering inventory updates via ReceiveStockAction.
 *
 * Quantity used for inventory = net_received_quantity (falls back to received_quantity for legacy records).
 * Landed unit cost is computed per line: unit_price + (total_extra_landed_costs / total_net_qty).
 */
final class PostGoodsReceiptAction extends BaseAction
{
    public function __construct(
        private readonly GoodsReceiptRepositoryInterface $receipts,
        private readonly ReceiveStockAction $receiveStock,
        private readonly CreateReceiptLayersAction $createLayers,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $receipt = $this->receipts->findById($id);

        if ($receipt === null) {
            throw new GoodsReceiptNotFoundException($id);
        }

        // ── Guard 1: duplicate posting ────────────────────────────────────────
        if ($receipt->status === GoodsReceiptStatus::Posted) {
            throw new GoodsReceiptAlreadyPostedException($receipt->receipt_number);
        }

        // Eager-load all relationships used in this action to avoid N+1 and
        // ensure data is available before the transaction opens.
        $receipt->loadMissing(['purchaseOrder', 'lines', 'warehouse']);

        // ── Guard 2: PO must be in a receivable state ─────────────────────────
        $po = $receipt->purchaseOrder;

        if ($po->status === PurchaseOrderStatus::Cancelled) {
            throw new PurchaseOrderCancelledException($po->po_number);
        }

        if ($po->status === PurchaseOrderStatus::Closed) {
            throw new PurchaseOrderClosedException($po->po_number);
        }

        if (! $po->status->canReceive()) {
            throw new InvalidPurchaseOrderStatusException(
                $po->po_number,
                $po->status->value,
                [PurchaseOrderStatus::Approved->value, PurchaseOrderStatus::PartiallyReceived->value],
            );
        }

        // ── Guard 3: receipt must have at least one non-zero net-quantity line ─
        $activeLines = $receipt->lines->filter(
            fn (GoodsReceiptLine $l): bool => $l->effectiveReceivedQty() > 0,
        );

        if ($activeLines->isEmpty()) {
            throw new EmptyGoodsReceiptException($receipt->receipt_number);
        }

        // company_id: prefer PO's own company, fall back to receiving warehouse's company
        $companyId = $po->company_id ?? $receipt->warehouse->company_id;

        // ── Pre-compute landed cost distribution ──────────────────────────────
        $totalExtraCosts = $receipt->totalLandedCosts();
        $totalNetQty = $activeLines->sum(fn (GoodsReceiptLine $l): float => $l->effectiveReceivedQty());
        $extraPerUnit = $totalNetQty > 0 ? $totalExtraCosts / $totalNetQty : 0.0;

        // ── Snapshot on-hand qtys BEFORE inventory is updated ────────────────
        $productIds = $activeLines->pluck('product_id')->unique()->values()->all();
        $preReceiptQtys = InventoryItem::query()
            ->whereIn('product_id', $productIds)
            ->where('warehouse_id', $receipt->warehouse_id)
            ->pluck('on_hand_qty', 'product_id')
            ->map(fn ($qty): float => (float) $qty)
            ->all();

        DB::transaction(function () use ($receipt, $activeLines, $po, $companyId, $extraPerUnit, $preReceiptQtys): void {

            // ── Guard 4 (locked): over-receipt check ──────────────────────────
            foreach ($activeLines as $line) {
                /** @var GoodsReceiptLine $line */
                $poLine = PurchaseOrderLine::query()
                    ->lockForUpdate()
                    ->findOrFail($line->purchase_order_line_id);

                $netQty = $line->effectiveReceivedQty();
                $newTotal = (float) $poLine->received_qty + $netQty;

                if ($newTotal > (float) $poLine->quantity) {
                    throw new OverReceiptException(
                        $po->po_number,
                        (float) $poLine->quantity,
                        (float) $poLine->received_qty,
                        $netQty,
                    );
                }
            }

            // ── Step 1: inventory update + landed cost stamp per line ─────────
            foreach ($activeLines as $line) {
                /** @var GoodsReceiptLine $line */
                $netQty = $line->effectiveReceivedQty();
                $landedUnitCost = round((float) $line->unit_price + $extraPerUnit, 4);

                $this->receiveStock->execute(
                    StockOperationDTO::fromArray([
                        'warehouse_id' => $receipt->warehouse_id,
                        'product_id' => $line->product_id,
                        'company_id' => $companyId,
                        'quantity' => $netQty,
                        'reference_type' => 'goods_receipt',
                        'reference_id' => $receipt->id,
                        'notes' => "GR {$receipt->receipt_number}",
                        // Hand the landed cost down so the resulting financial
                        // event is valued at the price actually paid, not at a
                        // running average of older stock.
                        'unit_cost' => $landedUnitCost,
                    ]),
                );

                GoodsReceiptLine::query()
                    ->where('id', $line->id)
                    ->update(['landed_unit_cost' => $landedUnitCost]);

                // ── Step 2: cumulative received qty on PO line ────────────────
                PurchaseOrderLine::query()
                    ->where('id', $line->purchase_order_line_id)
                    ->increment('received_qty', $netQty);
            }

            // ── Step 3: advance PO status ─────────────────────────────────────
            $poLines = PurchaseOrderLine::query()
                ->where('purchase_order_id', $po->id)
                ->get();

            $allFullyReceived = $poLines->every(
                fn (PurchaseOrderLine $l): bool => (float) $l->received_qty >= (float) $l->quantity,
            );

            $po->update([
                'status' => $allFullyReceived
                    ? PurchaseOrderStatus::Received->value
                    : PurchaseOrderStatus::PartiallyReceived->value,
            ]);

            // ── Step 4: stamp the receipt as Posted ───────────────────────────
            $receipt->update([
                'status' => GoodsReceiptStatus::Posted->value,
                'posted_at' => now(),
            ]);

            // ── Step 5: create receipt layers + update product cost intel ─────
            $receipt->refresh(); // reload with updated landed_unit_cost on lines
            $this->createLayers->execute($receipt, $preReceiptQtys);
        });

        return OperationResult::success(
            $this->receipts->findById($id),
            'Goods receipt posted. Inventory updated.',
        );
    }
}
