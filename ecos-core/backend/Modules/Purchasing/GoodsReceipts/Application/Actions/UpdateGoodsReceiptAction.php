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
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\GoodsReceiptNotEditableException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\GoodsReceiptNotFoundException;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;

final class UpdateGoodsReceiptAction extends BaseAction
{
    public function __construct(private readonly GoodsReceiptRepositoryInterface $receipts) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $dto = $arguments[1] ?? null;

        if (! $dto instanceof GoodsReceiptDTO) {
            throw new InvalidArgumentException('UpdateGoodsReceiptAction::execute expects a GoodsReceiptDTO as second argument.');
        }

        $receipt = $this->receipts->findById($id);

        if ($receipt === null) {
            throw new GoodsReceiptNotFoundException($id);
        }

        if (! $receipt->status->isEditable()) {
            throw new GoodsReceiptNotEditableException($receipt->receipt_number);
        }

        $attributes = [
            'purchase_order_id' => $dto->purchase_order_id,
            'warehouse_id' => $dto->warehouse_id,
            'receipt_date' => $dto->receipt_date,
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

        $updated = $this->receipts->update($receipt, $attributes, $lines);

        return OperationResult::success($updated, 'Goods receipt updated successfully.');
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
