<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\ValueObjects;

/**
 * Hardware-independent representation of a receipt ready for output.
 *
 * Produced by ReceiptRenderer from a Receipt + ReceiptTemplate.
 * Any printer adapter consumes this VO — never the Receipt aggregate directly.
 * This keeps printing infrastructure fully outside the domain.
 */
final readonly class ReceiptRenderingModel
{
    public function __construct(
        // Template-driven header / footer
        public string $headerText,
        public string $footerText,

        // Receipt identity
        public string $receiptNumber,
        public string $receiptType,
        public string $issuedAt,
        public bool $isReprint,
        public int $reprintCount,

        // Transaction reference
        public string $transactionNumber,
        public string $terminalId,

        // Actors
        public ?string $cashierName,
        public ?string $customerName,

        // Line data
        public array $lines,

        // Financial data
        public array $totals,
        public array $payments,

        // Currency
        public string $currency,

        // Template display flags
        public bool $showSku,
        public bool $showCashierName,
        public bool $showCustomerName,
        public bool $showTaxBreakdown,
    ) {}

    public function toArray(): array
    {
        return [
            'header_text' => $this->headerText,
            'footer_text' => $this->footerText,
            'receipt_number' => $this->receiptNumber,
            'receipt_type' => $this->receiptType,
            'issued_at' => $this->issuedAt,
            'is_reprint' => $this->isReprint,
            'reprint_count' => $this->reprintCount,
            'transaction_number' => $this->transactionNumber,
            'terminal_id' => $this->terminalId,
            'cashier_name' => $this->cashierName,
            'customer_name' => $this->customerName,
            'lines' => $this->lines,
            'totals' => $this->totals,
            'payments' => $this->payments,
            'currency' => $this->currency,
            'show_sku' => $this->showSku,
            'show_cashier_name' => $this->showCashierName,
            'show_customer_name' => $this->showCustomerName,
            'show_tax_breakdown' => $this->showTaxBreakdown,
        ];
    }
}
