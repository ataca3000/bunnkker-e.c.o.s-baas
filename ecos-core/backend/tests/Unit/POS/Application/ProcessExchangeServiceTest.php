<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Application;

use Illuminate\Support\Facades\DB;
use Modules\POS\Application\Commands\ProcessExchangeCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\SaleNotFoundException;
use Modules\POS\Application\Results\ProcessExchangeResult;
use Modules\POS\Application\Services\ProcessExchangeService;
use Modules\POS\Exchange\Domain\Contracts\ExchangeRepositoryInterface;
use Modules\POS\Receipt\Domain\Contracts\ReceiptNumberingStrategyInterface;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Sale\Domain\Models\Sale;
use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

final class ProcessExchangeServiceTest extends TestCase
{
    private SaleRepositoryInterface $saleRepo;

    private ExchangeRepositoryInterface $exchangeRepo;

    private ReceiptRepositoryInterface $receiptRepo;

    private ReceiptNumberingStrategyInterface $numbering;

    private DomainEventPublisherInterface $publisher;

    private ProcessExchangeService $service;

    protected function setUp(): void
    {
        parent::setUp();

        DB::shouldReceive('transaction')
            ->andReturnUsing(fn (callable $cb) => $cb());

        $this->saleRepo = $this->createMock(SaleRepositoryInterface::class);
        $this->exchangeRepo = $this->createMock(ExchangeRepositoryInterface::class);
        $this->receiptRepo = $this->createMock(ReceiptRepositoryInterface::class);
        $this->numbering = $this->createMock(ReceiptNumberingStrategyInterface::class);
        $this->publisher = $this->createMock(DomainEventPublisherInterface::class);

        $this->numbering->method('next')->willReturn('RCP-EXC-00001');

        $this->service = new ProcessExchangeService(
            $this->saleRepo,
            $this->exchangeRepo,
            $this->receiptRepo,
            $this->numbering,
            $this->publisher,
        );
    }

    public function test_throws_when_sale_not_found(): void
    {
        $this->saleRepo->method('findById')->willReturn(null);

        $this->expectException(SaleNotFoundException::class);

        $this->service->execute($this->makeCommand());
    }

    public function test_processes_exchange_and_saves_all(): void
    {
        $this->saleRepo->method('findById')->willReturn($this->makeSale());
        $this->exchangeRepo->expects($this->once())->method('save');
        $this->receiptRepo->expects($this->once())->method('save');
        $this->publisher->method('publishAll');

        $this->service->execute($this->makeCommand());
    }

    public function test_exchange_is_completed_after_processing(): void
    {
        $this->saleRepo->method('findById')->willReturn($this->makeSale());

        $savedExchange = null;
        $this->exchangeRepo->method('save')->willReturnCallback(function ($e) use (&$savedExchange) {
            $savedExchange = $e;
        });
        $this->receiptRepo->method('save');
        $this->publisher->method('publishAll');

        $this->service->execute($this->makeCommand());

        $this->assertTrue($savedExchange->isCompleted());
    }

    public function test_returns_result(): void
    {
        $this->saleRepo->method('findById')->willReturn($this->makeSale());
        $this->exchangeRepo->method('save');
        $this->receiptRepo->method('save');
        $this->publisher->method('publishAll');

        $result = $this->service->execute($this->makeCommand());

        $this->assertInstanceOf(ProcessExchangeResult::class, $result);
        $this->assertSame('EXC-001', $result->exchangeNumber);
        $this->assertSame('RCP-EXC-00001', $result->receiptNumber);
    }

    public function test_publishes_exchange_and_receipt_events(): void
    {
        $this->saleRepo->method('findById')->willReturn($this->makeSale());
        $this->exchangeRepo->method('save');
        $this->receiptRepo->method('save');

        $this->publisher
            ->expects($this->once())
            ->method('publishAll')
            ->with($this->callback(fn (array $events) => count($events) >= 4));

        $this->service->execute($this->makeCommand());
    }

    private function makeSale(): Sale
    {
        $sale = Sale::record(
            cartId: 'cart-1',
            paymentId: 'pay-1',
            sessionId: 'sess-1',
            shiftId: 'shift-1',
            terminalId: 'term-1',
            cashierId: 'cashier-1',
            customerId: null,
            currency: 'EGP',
            receiptNumber: 'SALE-001',
            lines: [
                new SaleLine('ln-1', 'prod-1', 'Product A', 'SKU-001',
                    Quantity::of('1'), Money::of('100.00', 'EGP'), null, null,
                    Money::of('100.00', 'EGP'), 0),
            ],
            subtotal: Money::of('100.00', 'EGP'),
            discountTotal: Money::of('0.00', 'EGP'),
            total: Money::of('100.00', 'EGP'),
            amountPaid: Money::of('100.00', 'EGP'),
            changeGiven: Money::of('0.00', 'EGP'),
            paymentSummaries: [
                new PaymentSummaryLine(PaymentMethodType::Cash, Money::of('100.00', 'EGP'), null),
            ],
        );

        $sale->complete();
        $sale->id = 'sale-1';

        return $sale;
    }

    private function makeCommand(): ProcessExchangeCommand
    {
        return new ProcessExchangeCommand(
            originalSaleId: 'sale-1',
            originalSaleNumber: 'SALE-001',
            sessionId: 'sess-1',
            shiftId: 'shift-1',
            terminalId: 'term-1',
            cashierId: 'cashier-1',
            customerId: null,
            currency: 'EGP',
            exchangeNumber: 'EXC-001',
            returnedLines: [
                [
                    'original_line_id' => 'ln-1',
                    'product_id' => 'prod-1',
                    'product_name' => 'Product A',
                    'sku' => 'SKU-001',
                    'quantity' => '1',
                    'unit_price' => ['amount' => '100.00', 'currency' => 'EGP'],
                    'line_total' => ['amount' => '100.00', 'currency' => 'EGP'],
                    'sort_order' => 0,
                ],
            ],
            replacementLines: [
                [
                    'original_line_id' => null,
                    'product_id' => 'prod-2',
                    'product_name' => 'Product B',
                    'sku' => 'SKU-002',
                    'quantity' => '1',
                    'unit_price' => ['amount' => '120.00', 'currency' => 'EGP'],
                    'line_total' => ['amount' => '120.00', 'currency' => 'EGP'],
                    'sort_order' => 0,
                ],
            ],
            reason: 'defective',
        );
    }
}
