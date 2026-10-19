<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Application;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Application\Commands\ReprintReceiptCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Results\ReprintReceiptResult;
use Modules\POS\Application\Services\ReprintReceiptService;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Receipt\Domain\Enums\ReceiptType;
use Modules\POS\Receipt\Domain\Events\ReceiptReprinted;
use Modules\POS\Receipt\Domain\Models\Receipt;
use Modules\POS\Receipt\Domain\Policies\ReprintPolicy;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptLineItem;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptPayment;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptTotals;
use Tests\TestCase;

final class ReprintReceiptServiceTest extends TestCase
{
    private ReceiptRepositoryInterface $receiptRepo;

    private DomainEventPublisherInterface $publisher;

    private ReprintReceiptService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->receiptRepo = $this->createMock(ReceiptRepositoryInterface::class);
        $this->publisher = $this->createMock(DomainEventPublisherInterface::class);
        $this->service = new ReprintReceiptService(
            $this->receiptRepo,
            new ReprintPolicy,
            $this->publisher,
        );
    }

    public function test_increments_reprint_count_and_saves(): void
    {
        $receipt = $this->makeReceipt();
        $this->receiptRepo->method('findById')->willReturn($receipt);
        $this->receiptRepo->expects($this->once())->method('save')->with($receipt);
        $this->publisher->method('publishAll');

        $result = $this->service->execute(
            new ReprintReceiptCommand('rcpt-1', 'cashier-1', 'term-1', 'customer_request'),
        );

        $this->assertSame(1, $result->reprintCount);
    }

    public function test_returns_result(): void
    {
        $receipt = $this->makeReceipt();
        $this->receiptRepo->method('findById')->willReturn($receipt);
        $this->receiptRepo->method('save');
        $this->publisher->method('publishAll');

        $result = $this->service->execute(
            new ReprintReceiptCommand('rcpt-1', 'cashier-1', 'term-1', 'customer_request'),
        );

        $this->assertInstanceOf(ReprintReceiptResult::class, $result);
        $this->assertSame('RCP-001', $result->receiptNumber);
    }

    public function test_publishes_receipt_reprinted_event(): void
    {
        $receipt = $this->makeReceipt();
        $this->receiptRepo->method('findById')->willReturn($receipt);
        $this->receiptRepo->method('save');

        $this->publisher
            ->expects($this->once())
            ->method('publishAll')
            ->with($this->callback(fn (array $events) => count($events) === 1 && $events[0] instanceof ReceiptReprinted,
            ));

        $this->service->execute(
            new ReprintReceiptCommand('rcpt-1', 'cashier-1', 'term-1', 'customer_request'),
        );
    }

    private function makeReceipt(): Receipt
    {
        $receipt = Receipt::issue(
            receiptNumber: 'RCP-001',
            type: ReceiptType::Sale,
            originalTransactionId: 'sale-1',
            originalTransactionNumber: 'SALE-001',
            terminalId: 'term-1',
            sessionId: 'sess-1',
            shiftId: 'shift-1',
            cashierId: 'cashier-1',
            cashierName: 'Test Cashier',
            customerId: null,
            customerName: null,
            currency: 'EGP',
            lineItems: [
                ReceiptLineItem::of('prod-1', 'Product A', 'SKU-001', '1', '100.00', '100.00', 'EGP'),
            ],
            totals: ReceiptTotals::of('100.00', '0.00', '0.00', '100.00', '100.00', '0.00', 'EGP'),
            payments: [ReceiptPayment::of('cash', '100.00', 'EGP')],
            issuedAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
        );

        $receipt->pullDomainEvents();

        return $receipt;
    }
}
