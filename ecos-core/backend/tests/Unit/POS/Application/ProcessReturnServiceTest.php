<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Application;

use Illuminate\Support\Facades\DB;
use Modules\POS\Application\Commands\ProcessReturnCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\SaleNotFoundException;
use Modules\POS\Application\Results\ProcessReturnResult;
use Modules\POS\Application\Services\ProcessReturnService;
use Modules\POS\Receipt\Domain\Contracts\ReceiptNumberingStrategyInterface;
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

final class ProcessReturnServiceTest extends TestCase
{
    private SaleRepositoryInterface $saleRepo;

    private SaleReturnRepositoryInterface $returnRepo;

    private ReceiptRepositoryInterface $receiptRepo;

    private ReceiptNumberingStrategyInterface $numbering;

    private DomainEventPublisherInterface $publisher;

    private ProcessReturnService $service;

    protected function setUp(): void
    {
        parent::setUp();

        DB::shouldReceive('transaction')
            ->andReturnUsing(fn (callable $cb) => $cb());

        $this->saleRepo = $this->createMock(SaleRepositoryInterface::class);
        $this->returnRepo = $this->createMock(SaleReturnRepositoryInterface::class);
        $this->receiptRepo = $this->createMock(ReceiptRepositoryInterface::class);
        $this->numbering = $this->createMock(ReceiptNumberingStrategyInterface::class);
        $this->publisher = $this->createMock(DomainEventPublisherInterface::class);

        $this->numbering->method('next')->willReturn('RCP-RTN-00001');

        $this->service = new ProcessReturnService(
            $this->saleRepo,
            $this->returnRepo,
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

    public function test_processes_return_and_saves_all(): void
    {
        $sale = $this->makeSale('100.00');
        $this->saleRepo->method('findById')->willReturn($sale);
        $this->returnRepo->expects($this->once())->method('save')
            ->willReturnCallback(fn ($r) => $r->id = 'return-uuid');
        $this->saleRepo->expects($this->once())->method('save')->with($sale);
        $this->receiptRepo->expects($this->once())->method('save');
        $this->publisher->method('publishAll');

        $this->service->execute($this->makeCommand());
    }

    public function test_marks_sale_fully_refunded_when_full_amount(): void
    {
        $sale = $this->makeSale('100.00');
        $this->saleRepo->method('findById')->willReturn($sale);
        $this->returnRepo->method('save')->willReturnCallback(fn ($r) => $r->id = 'return-uuid');
        $this->saleRepo->method('save');
        $this->receiptRepo->method('save');
        $this->publisher->method('publishAll');

        $this->service->execute($this->makeCommand(refundAmount: '100.00'));

        $this->assertTrue($sale->isRefunded());
    }

    public function test_marks_sale_partially_refunded_when_partial(): void
    {
        $sale = $this->makeSale('100.00');
        $this->saleRepo->method('findById')->willReturn($sale);
        $this->returnRepo->method('save')->willReturnCallback(fn ($r) => $r->id = 'return-uuid');
        $this->saleRepo->method('save');
        $this->receiptRepo->method('save');
        $this->publisher->method('publishAll');

        $this->service->execute($this->makeCommand(refundAmount: '50.00'));

        $this->assertTrue($sale->isPartiallyRefunded());
    }

    public function test_returns_result(): void
    {
        $sale = $this->makeSale('100.00');
        $this->saleRepo->method('findById')->willReturn($sale);
        $this->returnRepo->method('save')->willReturnCallback(function ($r) {
            $r->id = 'return-uuid';
        });
        $this->saleRepo->method('save');
        $this->receiptRepo->method('save');
        $this->publisher->method('publishAll');

        $result = $this->service->execute($this->makeCommand());

        $this->assertInstanceOf(ProcessReturnResult::class, $result);
        $this->assertSame('RTN-001', $result->returnNumber);
        $this->assertSame('RCP-RTN-00001', $result->receiptNumber);
    }

    private function makeSale(string $totalAmount): Sale
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
                    Money::of($totalAmount, 'EGP'), 0),
            ],
            subtotal: Money::of($totalAmount, 'EGP'),
            discountTotal: Money::of('0.00', 'EGP'),
            total: Money::of($totalAmount, 'EGP'),
            amountPaid: Money::of($totalAmount, 'EGP'),
            changeGiven: Money::of('0.00', 'EGP'),
            paymentSummaries: [
                new PaymentSummaryLine(PaymentMethodType::Cash, Money::of($totalAmount, 'EGP'), null),
            ],
        );

        $sale->complete();
        $sale->id = 'sale-1';

        return $sale;
    }

    private function makeCommand(string $refundAmount = '100.00'): ProcessReturnCommand
    {
        return new ProcessReturnCommand(
            saleId: 'sale-1',
            originalReceiptNumber: 'SALE-001',
            sessionId: 'sess-1',
            shiftId: 'shift-1',
            terminalId: 'term-1',
            cashierId: 'cashier-1',
            customerId: null,
            currency: 'EGP',
            returnNumber: 'RTN-001',
            lines: [
                [
                    'line_id' => 'ln-1',
                    'product_id' => 'prod-1',
                    'product_name' => 'Product A',
                    'sku' => 'SKU-001',
                    'quantity' => '1',
                    'unit_price' => ['amount' => '100.00', 'currency' => 'EGP'],
                    'refund_amount' => ['amount' => $refundAmount, 'currency' => 'EGP'],
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
