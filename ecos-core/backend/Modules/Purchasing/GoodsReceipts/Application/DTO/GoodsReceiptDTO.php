<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Application\DTO;

use App\Core\DTO\BaseDTO;

final class GoodsReceiptDTO extends BaseDTO
{
    /**
     * @param  list<GoodsReceiptLineDTO>  $lines
     */
    public function __construct(
        public readonly string $purchase_order_id,
        public readonly string $warehouse_id,
        public readonly string $receipt_date,
        public readonly ?string $notes,
        public readonly array $lines,
        // Supplier invoice
        public readonly ?string $supplier_invoice_number = null,
        public readonly ?string $supplier_invoice_date = null,
        public readonly ?string $invoice_attachment_path = null,
        // Invoice financials (stored for future AP integration)
        public readonly float $invoice_total_amount = 0.0,
        public readonly float $paid_amount = 0.0,
        public readonly float $freight_amount = 0.0,
        public readonly float $tax_amount = 0.0,
        public readonly float $additional_costs = 0.0,
        // Payment tracking
        public readonly ?string $payment_status = null,
        public readonly ?string $payment_method = null,
        public readonly ?int $payment_terms_days = null,
        public readonly ?string $payment_due_date = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $rawLines = is_array($data['lines'] ?? null) ? $data['lines'] : [];

        $lines = array_map(
            fn (mixed $line): GoodsReceiptLineDTO => GoodsReceiptLineDTO::fromArray((array) $line),
            $rawLines,
        );

        $paymentTermsDays = isset($data['payment_terms_days']) && $data['payment_terms_days'] !== ''
            ? (int) $data['payment_terms_days']
            : null;

        return new self(
            purchase_order_id: (string) $data['purchase_order_id'],
            warehouse_id: (string) $data['warehouse_id'],
            receipt_date: (string) $data['receipt_date'],
            notes: self::nullableString($data, 'notes'),
            lines: array_values($lines),
            supplier_invoice_number: self::nullableString($data, 'supplier_invoice_number'),
            supplier_invoice_date: self::nullableString($data, 'supplier_invoice_date'),
            invoice_attachment_path: self::nullableString($data, 'invoice_attachment_path'),
            invoice_total_amount: (float) ($data['invoice_total_amount'] ?? 0),
            paid_amount: (float) ($data['paid_amount'] ?? 0),
            freight_amount: (float) ($data['freight_amount'] ?? 0),
            tax_amount: (float) ($data['tax_amount'] ?? 0),
            additional_costs: (float) ($data['additional_costs'] ?? 0),
            payment_status: self::nullableString($data, 'payment_status'),
            payment_method: self::nullableString($data, 'payment_method'),
            payment_terms_days: $paymentTermsDays,
            payment_due_date: self::nullableString($data, 'payment_due_date'),
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function nullableString(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return $value === null || $value === '' ? null : (string) $value;
    }
}
