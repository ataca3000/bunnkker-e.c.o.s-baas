<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Application;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Application\Commands\ProcessReturnCommand;
use Modules\POS\Application\Results\ProcessReturnResult;
use Modules\POS\Application\Services\ProcessReturnService;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Returns\Domain\Contracts\SaleReturnRepositoryInterface;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Sale\Domain\Models\Sale;
use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

/**
 * PKG-POS-017: ProcessReturnService integration tests.
 *
 * Requires PostgreSQL — run with:
 *   php artisan test tests/Feature/POS/Application/ProcessReturnIntegrationTest.php
 */
final class ProcessReturnIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private ProcessReturnService $service;

    private SaleRepositoryInterface $saleRepo;

    private SaleReturnRepositoryInterface $returnRepo;

    private ReceiptRepositoryInterface $receiptRepo;

    private const SESSION_ID = 'a2000000-0000-4000-a000-000000000001';

    private const SHIFT_ID = 'b2000000-0000-4000-b000-000000000001';

    private const TERMINAL_ID = 'c2000000-0000-4000-c000-000000000001';

    private const CASHIER_ID = 'd2000000-0000-4000-d000-000000000001';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(ProcessReturnService::class);
        $this->saleRepo = app(SaleRepositoryInterface::class);
        $this->returnRepo = app(SaleReturnRepositoryInterface::class);
        $this->receiptRepo = app(ReceiptRepositoryInterface::class);
    }

    public function test_processes_return_and_persists_all_entities(): void
    {
        $sale = $this->makePersistedSale('100.00');

        $result = $this->service->execute($this->makeCommand((string) $sale->id, '100.00'));

        $this->assertInstanceOf(ProcessReturnResult::class, $result);
        $this->assertNotEmpty($result->returnId);
        $this->assertNotEmpty($result->receiptId);
    }

    public function test_return_record_exists_in_database(): void
    {
        $sale = $this->makePersistedSale('100.00');

        $result = $this->service->execute($this->makeCommand((string) $sale->id, '100.00'));

        $saleReturn = $this->returnRepo->findById($result->returnId);
        $this->assertNotNull($saleReturn);
        $this->assertStringStartsWith('RTN-', $saleReturn->return_number);
    }

    public function test_receipt_record_exists_in_database(): void
    {
        $sale = $this->makePersistedSale('100.00');

        $result = $this->service->execute($this->makeCommand((string) $sale->id, '100.00'));

        $receipt = $this->receiptRepo->findById($result->receiptId);
        $this->assertNotNull($receipt);
        $this->assertSame($result->receiptNumber, $receipt->receipt_number);
    }

    public function test_sale_is_marked_fully_refunded_when_full_amount(): void
    {
        $sale = $this->makePersistedSale('100.00');
        $saleId = (string) $sale->id;

        $this->service->execute($this->makeCommand($saleId, '100.00'));

        $refreshed = $this->saleRepo->findById($saleId);
        $this->assertTrue($refreshed->isRefunded());
    }

    public function test_sale_is_marked_partially_refunded_when_partial_amount(): void
    {
        $sale = $this->makePersistedSale('100.00');
        $saleId = (string) $sale->id;

        $this->service->execute($this->makeCommand($saleId, '50.00'));

        $refreshed = $this->saleRepo->findById($saleId);
        $this->assertTrue($refreshed->isPartiallyRefunded());
    }

    private function makePersistedSale(string $totalAmount): Sale
    {
        $sale = Sale::record(
            cartId: 'a2000000-cart-4000-a000-000000000001',
            paymentId: 'a2000000-pay0-4000-a000-000000000001',
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            receiptNumber: 'SALE-INTG-001',
            lines: [
                new SaleLine(
                    'ln-intg-1', 'prod-1', 'Widget', 'WGT-001',
                    Quantity::of('1'), Money::of($totalAmount, self::CURRENCY),
                    null, null,
                    Money::of($totalAmount, self::CURRENCY), 0,
                ),
            ],
            subtotal: Money::of($totalAmount, self::CURRENCY),
            discountTotal: Money::of('0.00', self::CURRENCY),
            total: Money::of($totalAmount, self::CURRENCY),
            amountPaid: Money::of($totalAmount, self::CURRENCY),
            changeGiven: Money::of('0.00', self::CURRENCY),
            paymentSummaries: [
                new PaymentSummaryLine(
                    PaymentMethodType::Cash,
                    Money::of($totalAmount, self::CURRENCY),
                    null,
                ),
            ],
        );

        $sale->complete();
        $this->saleRepo->save($sale);

        return $sale;
    }

    private function makeCommand(string $saleId, string $refundAmount): ProcessReturnCommand
    {
        return new ProcessReturnCommand(
            saleId: $saleId,
            originalReceiptNumber: 'SALE-INTG-001',
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            lines: [
                [
                    'line_id' => 'ln-intg-1',
                    'product_id' => 'prod-1',
                    'product_name' => 'Widget',
                    'sku' => 'WGT-001',
                    'quantity' => '1',
                    'unit_price' => ['amount' => '100.00', 'currency' => self::CURRENCY],
                    'refund_amount' => ['amount' => $refundAmount, 'currency' => self::CURRENCY],
                    'reason' => 'customer_preference',
                    'should_restock' => true,
                    'sort_order' => 0,
                ],
            ],
            refundTotalAmount: $refundAmount,
            refundMethod: 'cash',
        );
    }
}
