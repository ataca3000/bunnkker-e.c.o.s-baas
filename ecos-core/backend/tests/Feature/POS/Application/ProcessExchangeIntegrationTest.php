<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Application;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Application\Commands\ProcessExchangeCommand;
use Modules\POS\Application\Results\ProcessExchangeResult;
use Modules\POS\Application\Services\ProcessExchangeService;
use Modules\POS\Exchange\Domain\Contracts\ExchangeRepositoryInterface;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Sale\Domain\Models\Sale;
use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

/**
 * PKG-POS-017: ProcessExchangeService integration tests.
 *
 * Requires PostgreSQL — run with:
 *   php artisan test tests/Feature/POS/Application/ProcessExchangeIntegrationTest.php
 */
final class ProcessExchangeIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private ProcessExchangeService $service;

    private SaleRepositoryInterface $saleRepo;

    private ExchangeRepositoryInterface $exchangeRepo;

    private ReceiptRepositoryInterface $receiptRepo;

    private const SESSION_ID = 'a3000000-0000-4000-a000-000000000001';

    private const SHIFT_ID = 'b3000000-0000-4000-b000-000000000001';

    private const TERMINAL_ID = 'c3000000-0000-4000-c000-000000000001';

    private const CASHIER_ID = 'd3000000-0000-4000-d000-000000000001';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(ProcessExchangeService::class);
        $this->saleRepo = app(SaleRepositoryInterface::class);
        $this->exchangeRepo = app(ExchangeRepositoryInterface::class);
        $this->receiptRepo = app(ReceiptRepositoryInterface::class);
    }

    public function test_processes_exchange_and_persists_all_entities(): void
    {
        $sale = $this->makePersistedSale();

        $result = $this->service->execute($this->makeCommand((string) $sale->id));

        $this->assertInstanceOf(ProcessExchangeResult::class, $result);
        $this->assertNotEmpty($result->exchangeId);
        $this->assertNotEmpty($result->receiptId);
    }

    public function test_exchange_record_exists_in_database(): void
    {
        $sale = $this->makePersistedSale();

        $result = $this->service->execute($this->makeCommand((string) $sale->id));

        $exchange = $this->exchangeRepo->findById($result->exchangeId);
        $this->assertNotNull($exchange);
        $this->assertStringStartsWith('EXC-', $exchange->exchange_number);
        $this->assertTrue($exchange->isCompleted());
    }

    public function test_receipt_record_exists_in_database(): void
    {
        $sale = $this->makePersistedSale();

        $result = $this->service->execute($this->makeCommand((string) $sale->id));

        $receipt = $this->receiptRepo->findById($result->receiptId);
        $this->assertNotNull($receipt);
        $this->assertSame($result->receiptNumber, $receipt->receipt_number);
    }

    public function test_exchange_number_is_sequential_format(): void
    {
        $sale = $this->makePersistedSale();

        $result = $this->service->execute($this->makeCommand((string) $sale->id));

        $this->assertStringStartsWith('EXC-', $result->exchangeNumber);
    }

    private function makePersistedSale(): Sale
    {
        $sale = Sale::record(
            cartId: 'a3000000-cart-4000-a000-000000000001',
            paymentId: 'a3000000-pay0-4000-a000-000000000001',
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            receiptNumber: 'SALE-EXC-INTG-001',
            lines: [
                new SaleLine(
                    'ln-exc-intg-1', 'prod-1', 'Widget A', 'WGT-001',
                    Quantity::of('1'), Money::of('100.00', self::CURRENCY),
                    null, null,
                    Money::of('100.00', self::CURRENCY), 0,
                ),
            ],
            subtotal: Money::of('100.00', self::CURRENCY),
            discountTotal: Money::of('0.00', self::CURRENCY),
            total: Money::of('100.00', self::CURRENCY),
            amountPaid: Money::of('100.00', self::CURRENCY),
            changeGiven: Money::of('0.00', self::CURRENCY),
            paymentSummaries: [
                new PaymentSummaryLine(
                    PaymentMethodType::Cash,
                    Money::of('100.00', self::CURRENCY),
                    null,
                ),
            ],
        );

        $sale->complete();
        $this->saleRepo->save($sale);

        return $sale;
    }

    private function makeCommand(string $saleId): ProcessExchangeCommand
    {
        return new ProcessExchangeCommand(
            originalSaleId: $saleId,
            originalSaleNumber: 'SALE-EXC-INTG-001',
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            returnedLines: [
                [
                    'original_line_id' => 'ln-exc-intg-1',
                    'product_id' => 'prod-1',
                    'product_name' => 'Widget A',
                    'sku' => 'WGT-001',
                    'quantity' => '1',
                    'unit_price' => ['amount' => '100.00', 'currency' => self::CURRENCY],
                    'line_total' => ['amount' => '100.00', 'currency' => self::CURRENCY],
                    'sort_order' => 0,
                ],
            ],
            replacementLines: [
                [
                    'original_line_id' => null,
                    'product_id' => 'prod-2',
                    'product_name' => 'Widget B',
                    'sku' => 'WGT-002',
                    'quantity' => '1',
                    'unit_price' => ['amount' => '120.00', 'currency' => self::CURRENCY],
                    'line_total' => ['amount' => '120.00', 'currency' => self::CURRENCY],
                    'sort_order' => 0,
                ],
            ],
            reason: 'defective',
        );
    }
}
