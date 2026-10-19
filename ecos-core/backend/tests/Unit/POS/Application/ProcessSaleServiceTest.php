<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Application;

use Illuminate\Support\Facades\DB;
use Modules\POS\Application\Commands\ProcessSaleCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\CartNotFoundException;
use Modules\POS\Application\Exceptions\CartNotReadyException;
use Modules\POS\Application\Results\ProcessSaleResult;
use Modules\POS\Application\Services\ProcessSaleService;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Domain\Models\Cart;
use Modules\POS\Payment\Domain\Contracts\PaymentRepositoryInterface;
use Modules\POS\Receipt\Domain\Contracts\ReceiptNumberingStrategyInterface;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Domain\Models\Session;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

final class ProcessSaleServiceTest extends TestCase
{
    private CartRepositoryInterface $cartRepo;

    private PaymentRepositoryInterface $paymentRepo;

    private SaleRepositoryInterface $saleRepo;

    private ReceiptRepositoryInterface $receiptRepo;

    private ReceiptNumberingStrategyInterface $numbering;

    private DomainEventPublisherInterface $publisher;

    private SessionRepositoryInterface $sessionRepo;

    private ProcessSaleService $service;

    protected function setUp(): void
    {
        parent::setUp();

        DB::shouldReceive('transaction')
            ->andReturnUsing(fn (callable $cb) => $cb());

        $this->cartRepo = $this->createMock(CartRepositoryInterface::class);
        $this->paymentRepo = $this->createMock(PaymentRepositoryInterface::class);
        $this->saleRepo = $this->createMock(SaleRepositoryInterface::class);
        $this->receiptRepo = $this->createMock(ReceiptRepositoryInterface::class);
        $this->numbering = $this->createMock(ReceiptNumberingStrategyInterface::class);
        $this->publisher = $this->createMock(DomainEventPublisherInterface::class);
        $this->sessionRepo = $this->createMock(SessionRepositoryInterface::class);

        $this->numbering->method('next')->willReturn('RCP-20260701-TRM001-00001');

        // Provide a session with company + warehouse context so SaleFinalized can be built.
        $session = new Session;
        $session->id = 'sess-1';
        $session->company_id = 'company-unit-001';
        $session->warehouse_id = 'warehouse-unit-001';
        $session->channel_id = null;

        $this->sessionRepo->method('findById')->willReturn($session);

        $this->service = new ProcessSaleService(
            $this->cartRepo,
            $this->paymentRepo,
            $this->saleRepo,
            $this->receiptRepo,
            $this->numbering,
            $this->publisher,
            $this->sessionRepo,
        );
    }

    public function test_throws_when_cart_not_found(): void
    {
        $this->cartRepo->method('findById')->willReturn(null);

        $this->expectException(CartNotFoundException::class);

        $this->service->execute($this->makeCommand());
    }

    public function test_throws_when_cart_is_completed(): void
    {
        $cart = $this->makeCartWithLine();
        $cart->initiatePayment();
        $cart->complete(new \Modules\POS\Cart\Domain\ValueObjects\ReceiptNumber('RCP-OLD'));

        $this->cartRepo->method('findById')->willReturn($cart);

        $this->expectException(CartNotReadyException::class);

        $this->service->execute($this->makeCommand());
    }

    public function test_throws_when_cart_is_cancelled(): void
    {
        $cart = $this->makeCartWithLine();
        $cart->cancel();

        $this->cartRepo->method('findById')->willReturn($cart);

        $this->expectException(CartNotReadyException::class);

        $this->service->execute($this->makeCommand());
    }

    public function test_completes_sale_within_transaction(): void
    {
        $cart = $this->makeCartWithLine();
        $this->cartRepo->method('findById')->willReturn($cart);
        $this->paymentRepo->expects($this->once())->method('save')
            ->willReturnCallback(fn ($p) => $p->id = 'pay-unit-001');
        $this->saleRepo->expects($this->once())->method('save')
            ->willReturnCallback(fn ($s) => $s->id = 'sale-unit-001');
        $this->cartRepo->expects($this->once())->method('save')->with($cart);
        $this->receiptRepo->expects($this->once())->method('save');
        $this->publisher->method('publishAll');

        $result = $this->service->execute($this->makeCommand());

        $this->assertInstanceOf(ProcessSaleResult::class, $result);
        $this->assertSame('RCP-20260701-TRM001-00001', $result->receiptNumber);
    }

    public function test_result_contains_totals(): void
    {
        $cart = $this->makeCartWithLine();
        $this->cartRepo->method('findById')->willReturn($cart);
        $this->paymentRepo->method('save')->willReturnCallback(fn ($p) => $p->id = 'pay-unit-001');
        $this->saleRepo->method('save')->willReturnCallback(fn ($s) => $s->id = 'sale-unit-001');
        $this->cartRepo->method('save');
        $this->receiptRepo->method('save');
        $this->publisher->method('publishAll');

        $result = $this->service->execute($this->makeCommand());

        $this->assertSame('100.00', $result->totalAmount);
        $this->assertSame('100.00', $result->amountPaid);
        $this->assertSame('0.00', $result->changeGiven);
        $this->assertSame('EGP', $result->currency);
    }

    public function test_publishes_sale_and_receipt_events(): void
    {
        $cart = $this->makeCartWithLine();
        $this->cartRepo->method('findById')->willReturn($cart);
        $this->paymentRepo->method('save')->willReturnCallback(fn ($p) => $p->id = 'pay-unit-001');
        $this->saleRepo->method('save')->willReturnCallback(fn ($s) => $s->id = 'sale-unit-001');
        $this->cartRepo->method('save');
        $this->receiptRepo->method('save');

        // Expects publishAll called once with domain events + SaleFinalized (>= 3 total)
        $this->publisher
            ->expects($this->once())
            ->method('publishAll')
            ->with($this->callback(fn (array $events) => count($events) >= 3));

        $this->service->execute($this->makeCommand());
    }

    public function test_sale_finalized_is_included_in_published_events(): void
    {
        $cart = $this->makeCartWithLine();
        $this->cartRepo->method('findById')->willReturn($cart);
        $this->paymentRepo->method('save')->willReturnCallback(fn ($p) => $p->id = 'pay-unit-001');
        $this->saleRepo->method('save')->willReturnCallback(fn ($s) => $s->id = 'sale-unit-001');
        $this->cartRepo->method('save');
        $this->receiptRepo->method('save');

        $capturedEvents = [];
        $this->publisher
            ->expects($this->once())
            ->method('publishAll')
            ->willReturnCallback(function (array $events) use (&$capturedEvents) {
                $capturedEvents = $events;
            });

        $this->service->execute($this->makeCommand());

        $eventNames = array_map(fn ($e) => $e->eventName(), $capturedEvents);
        $this->assertContains('pos.sale.finalized', $eventNames);
    }

    private function makeCartWithLine(): Cart
    {
        $cart = Cart::open('sess-1', 'shift-1', 'term-1', 'cashier-1', 'EGP');
        $cart->id = 'cart-unit-001';
        $cart->addLine('prod-1', 'Product A', 'SKU-001', Quantity::of('1'), Money::of('100.00', 'EGP'));

        return $cart;
    }

    private function makeCommand(): ProcessSaleCommand
    {
        return new ProcessSaleCommand(
            cartId: 'cart-1',
            sessionId: 'sess-1',
            shiftId: 'shift-1',
            terminalId: 'term-1',
            cashierId: 'cashier-1',
            customerId: null,
            currency: 'EGP',
            payments: [
                ['type' => 'cash', 'amount' => '100.00', 'currency' => 'EGP'],
            ],
            cashierName: 'Ali Hassan',
        );
    }
}
