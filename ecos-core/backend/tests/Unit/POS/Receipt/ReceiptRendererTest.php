<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Receipt\Domain\Enums\ReceiptType;
use Modules\POS\Receipt\Domain\Models\Receipt;
use Modules\POS\Receipt\Domain\Services\ReceiptRenderer;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptLineItem;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptPayment;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptRenderingModel;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptTotals;
use Tests\TestCase;

final class ReceiptRendererTest extends TestCase
{
    private ReceiptRenderer $renderer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->renderer = new ReceiptRenderer;
    }

    public function test_render_returns_rendering_model(): void
    {
        $receipt = $this->makeReceipt();
        $model = $this->renderer->render($receipt);

        $this->assertInstanceOf(ReceiptRenderingModel::class, $model);
    }

    public function test_render_copies_receipt_number(): void
    {
        $model = $this->renderer->render($this->makeReceipt());

        $this->assertSame('RCP-20260701-T01-00001', $model->receiptNumber);
    }

    public function test_render_uses_type_label(): void
    {
        $model = $this->renderer->render($this->makeReceipt());

        $this->assertSame('Sale', $model->receiptType);
    }

    public function test_render_sets_is_reprint_false_initially(): void
    {
        $model = $this->renderer->render($this->makeReceipt());

        $this->assertFalse($model->isReprint);
        $this->assertSame(0, $model->reprintCount);
    }

    public function test_render_sets_is_reprint_true_after_reprint(): void
    {
        $receipt = $this->makeReceipt();
        $receipt->reprint('cashier-1', 'term-1', \Modules\POS\Receipt\Domain\Enums\ReprintReason::CustomerRequest);

        $model = $this->renderer->render($receipt);

        $this->assertTrue($model->isReprint);
        $this->assertSame(1, $model->reprintCount);
    }

    public function test_render_sets_transaction_number(): void
    {
        $model = $this->renderer->render($this->makeReceipt());

        $this->assertSame('SALE-0001', $model->transactionNumber);
    }

    public function test_render_includes_lines_and_payments(): void
    {
        $model = $this->renderer->render($this->makeReceipt());

        $this->assertCount(1, $model->lines);
        $this->assertCount(1, $model->payments);
    }

    public function test_render_uses_empty_header_footer_without_template(): void
    {
        $model = $this->renderer->render($this->makeReceipt());

        $this->assertSame('', $model->headerText);
        $this->assertSame('', $model->footerText);
    }

    public function test_render_default_display_flags_without_template(): void
    {
        $model = $this->renderer->render($this->makeReceipt());

        $this->assertTrue($model->showSku);
        $this->assertTrue($model->showCashierName);
        $this->assertTrue($model->showCustomerName);
        $this->assertFalse($model->showTaxBreakdown);
    }

    public function test_to_array_has_expected_keys(): void
    {
        $array = $this->renderer->render($this->makeReceipt())->toArray();

        $this->assertArrayHasKey('header_text', $array);
        $this->assertArrayHasKey('footer_text', $array);
        $this->assertArrayHasKey('receipt_number', $array);
        $this->assertArrayHasKey('receipt_type', $array);
        $this->assertArrayHasKey('issued_at', $array);
        $this->assertArrayHasKey('is_reprint', $array);
        $this->assertArrayHasKey('reprint_count', $array);
        $this->assertArrayHasKey('transaction_number', $array);
        $this->assertArrayHasKey('terminal_id', $array);
        $this->assertArrayHasKey('cashier_name', $array);
        $this->assertArrayHasKey('customer_name', $array);
        $this->assertArrayHasKey('lines', $array);
        $this->assertArrayHasKey('totals', $array);
        $this->assertArrayHasKey('payments', $array);
        $this->assertArrayHasKey('currency', $array);
        $this->assertArrayHasKey('show_sku', $array);
        $this->assertArrayHasKey('show_cashier_name', $array);
        $this->assertArrayHasKey('show_customer_name', $array);
        $this->assertArrayHasKey('show_tax_breakdown', $array);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeReceipt(): Receipt
    {
        return Receipt::issue(
            receiptNumber: 'RCP-20260701-T01-00001',
            type: ReceiptType::Sale,
            originalTransactionId: 'sale-1',
            originalTransactionNumber: 'SALE-0001',
            terminalId: 'term-1',
            sessionId: 'sess-1',
            shiftId: 'shift-1',
            cashierId: 'cashier-1',
            cashierName: 'Ali Hassan',
            customerId: null,
            customerName: null,
            currency: 'EGP',
            lineItems: [
                ReceiptLineItem::of('prod-1', 'Blue Shirt', 'SKU-001', '1', '100.00', '100.00', 'EGP'),
            ],
            totals: ReceiptTotals::of('100.00', '0.00', '14.00', '114.00', '120.00', '6.00', 'EGP'),
            payments: [ReceiptPayment::of('cash', '120.00', 'EGP')],
            issuedAt: new DateTimeImmutable('2026-07-01 10:00:00', new DateTimeZone('UTC')),
        );
    }
}
