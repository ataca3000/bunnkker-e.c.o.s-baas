<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Carbon;
use InvalidArgumentException;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Purchasing\GoodsReceipts\Application\DTO\GoodsReceiptDTO;
use Modules\Purchasing\GoodsReceipts\Application\DTO\GoodsReceiptLineDTO;
use Modules\Purchasing\GoodsReceipts\Domain\Contracts\GoodsReceiptRepositoryInterface;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\PurchaseOrderCancelledException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\PurchaseOrderClosedException;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\InvalidPurchaseOrderStatusException;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;

final class CreateGoodsReceiptAction extends BaseAction
{
    public function __construct(private readonly GoodsReceiptRepositoryInterface $receipts) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof GoodsReceiptDTO) {
            throw new InvalidArgumentException('CreateGoodsReceiptAction::execute expects a GoodsReceiptDTO.');
        }

        $po = PurchaseOrder::query()->find($dto->purchase_order_id);

        if (! $po instanceof PurchaseOrder) {
            throw new InvalidPurchaseOrderStatusException($dto->purchase_order_id, 'not_found');
        }

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

        $attributes = [
            'receipt_number' => $this->receipts->nextReceiptNumber(),
            'purchase_order_id' => $dto->purchase_order_id,
            'warehouse_id' => $dto->warehouse_id,
            'receipt_date' => $dto->receipt_date,
            'status' => GoodsReceiptStatus::Draft->value,
            'notes' => $dto->notes,
            // Supplier invoice
            'supplier_invoice_number' => $dto->supplier_invoice_number,
            'supplier_invoice_date' => $dto->supplier_invoice_date,
            'invoice_attachment_path' => $dto->invoice_attachment_path,
            // Invoice financials
            'invoice_total_amount' => $dto->invoice_total_amount,
            'paid_amount' => $dto->paid_amount,
            'freight_amount' => $dto->freight_amount,
            'tax_amount' => $dto->tax_amount,
            'additional_costs' => $dto->additional_costs,
            // Payment tracking — auto-derived from paid_amount unless explicitly overridden
            'payment_status' => $dto->payment_status
                ?? GoodsReceipt::derivePaymentStatus($dto->paid_amount, $dto->invoice_total_amount),
            'payment_method' => $dto->payment_method,
            'payment_terms_days' => $dto->payment_terms_days,
            'payment_due_date' => $this->resolvePaymentDueDate($dto),
        ];

        $poLineUnitPrices = PurchaseOrderLine::query()
            ->whereIn('id', array_map(fn (GoodsReceiptLineDTO $l): string => $l->purchase_order_line_id, $dto->lines))
            ->pluck('unit_price', 'id');

        $productIds = array_map(fn (GoodsReceiptLineDTO $l): string => $l->product_id, $dto->lines);
        $products = Product::query()->with('unit')->whereIn('id', $productIds)->get()->keyBy('id');

        $lines = array_map(function (GoodsReceiptLineDTO $line) use ($poLineUnitPrices, $products): array {
            $unitPrice = (float) ($poLineUnitPrices[$line->purchase_order_line_id] ?? $line->unit_price);
            $variance = $line->net_received_quantity - $line->ordered_quantity;
            $product = $products->get($line->product_id);
            $unit = $product?->unit;

            return [
                'purchase_order_line_id' => $line->purchase_order_line_id,
                'product_id' => $line->product_id,
                'uom_id_snapshot' => $unit?->id,
                'uom_name_snapshot' => $unit?->name,
                'uom_symbol_snapshot' => $unit?->symbol,
                'ordered_quantity' => $line->ordered_quantity,
                'received_quantity' => $line->net_received_quantity,
                'gross_received_quantity' => $line->gross_received_quantity,
                'net_received_quantity' => $line->net_received_quantity,
                'variance_quantity' => $variance,
                'unit_price' => $unitPrice,
                'weight_photo_path' => $line->weight_photo_path,
                'notes' => $line->notes,
            ];
        }, $dto->lines);

        $receipt = $this->receipts->create($attributes, $lines);

        return OperationResult::success($receipt, 'Goods receipt created successfully.');
    }

    private function resolvePaymentDueDate(GoodsReceiptDTO $dto): ?string
    {
        // Manual override takes precedence
        if ($dto->payment_due_date !== null) {
            return $dto->payment_due_date;
        }

        // Auto-calculate from invoice date + payment terms
        if ($dto->supplier_invoice_date !== null && $dto->payment_terms_days !== null) {
            return Carbon::parse($dto->supplier_invoice_date)
                ->addDays($dto->payment_terms_days)
                ->toDateString();
        }

        return null;
    }
}
