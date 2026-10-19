<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Services;

use Modules\POS\Receipt\Domain\Models\Receipt;
use Modules\POS\Receipt\Domain\Models\ReceiptTemplate;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptRenderingModel;

use const DATE_ATOM;

/**
 * Produces a hardware-independent ReceiptRenderingModel from a Receipt and an optional template.
 *
 * Printer adapters consume the rendering model, never the Receipt aggregate.
 * All printing infrastructure lives outside this service.
 */
final class ReceiptRenderer
{
    public function render(Receipt $receipt, ?ReceiptTemplate $template = null): ReceiptRenderingModel
    {
        return new ReceiptRenderingModel(
            headerText: $template?->header_text ?? '',
            footerText: $template?->footer_text ?? '',

            receiptNumber: $receipt->receipt_number,
            receiptType: $receipt->type->label(),
            issuedAt: $receipt->issued_at->format(DATE_ATOM),
            isReprint: $receipt->reprint_count > 0,
            reprintCount: $receipt->reprint_count,

            transactionNumber: $receipt->original_transaction_number,
            terminalId: $receipt->terminal_id,

            cashierName: $receipt->cashier_name,
            customerName: $receipt->customer_name,

            lines: $receipt->getLineItems(),
            totals: $receipt->getTotals()->toArray(),
            payments: $receipt->getPayments(),

            currency: $receipt->currency,

            showSku: (bool) ($template?->getSetting('show_sku') ?? true),
            showCashierName: (bool) ($template?->getSetting('show_cashier_name') ?? true),
            showCustomerName: (bool) ($template?->getSetting('show_customer_name') ?? true),
            showTaxBreakdown: (bool) ($template?->getSetting('show_tax_breakdown') ?? false),
        );
    }
}
