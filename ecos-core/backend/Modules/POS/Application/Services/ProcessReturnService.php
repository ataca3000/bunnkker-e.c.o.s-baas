<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Modules\POS\Application\Commands\ProcessReturnCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Exceptions\SaleNotFoundException;
use Modules\POS\Application\Results\ProcessReturnResult;
use Modules\POS\Receipt\Domain\Contracts\ReceiptNumberingStrategyInterface;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Receipt\Domain\Enums\ReceiptType;
use Modules\POS\Receipt\Domain\Models\Receipt;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptLineItem;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptPayment;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptTotals;
use Modules\POS\Returns\Domain\Contracts\ReturnNumberingStrategyInterface;
use Modules\POS\Returns\Domain\Contracts\SaleReturnRepositoryInterface;
use Modules\POS\Returns\Domain\Models\SaleReturn;
use Modules\POS\Returns\Domain\ValueObjects\ReturnLine;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use RuntimeException;

final class ProcessReturnService
{
    public function __construct(
        private readonly SaleRepositoryInterface $saleRepo,
        private readonly SaleReturnRepositoryInterface $returnRepo,
        private readonly ReceiptRepositoryInterface $receiptRepo,
        private readonly ReceiptNumberingStrategyInterface $receiptNumbering,
        private readonly DomainEventPublisherInterface $publisher,
        private readonly ?ReturnNumberingStrategyInterface $returnNumbering = null,
    ) {}

    public function execute(ProcessReturnCommand $command): ProcessReturnResult
    {
        $sale = $this->saleRepo->findById($command->saleId);

        if ($sale === null) {
            throw SaleNotFoundException::withId($command->saleId);
        }

        $saleReturn = null;
        $receipt = null;
        $receiptNumber = null;

        DB::transaction(function () use ($command, $sale, &$saleReturn, &$receipt, &$receiptNumber) {
            $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
            $receiptNumber = $this->receiptNumbering->next($command->terminalId, $now);
            $returnNumber = $command->returnNumber
                ?? ($this->returnNumbering?->next($command->terminalId, $now)
                    ?? throw new RuntimeException('No return number: provide via command or inject ReturnNumberingStrategyInterface'));

            $returnLines = array_map(
                fn (array $line) => ReturnLine::fromArray($line),
                $command->lines,
            );

            $refundTotal = Money::of($command->refundTotalAmount, $command->currency);

            $saleReturn = SaleReturn::initiate(
                saleId: $command->saleId,
                originalReceiptNumber: $command->originalReceiptNumber,
                sessionId: $command->sessionId,
                shiftId: $command->shiftId,
                terminalId: $command->terminalId,
                cashierId: $command->cashierId,
                customerId: $command->customerId,
                currency: $command->currency,
                returnNumber: $returnNumber,
                lines: $returnLines,
                refundTotal: $refundTotal,
                refundMethod: PaymentMethodType::from($command->refundMethod),
                notes: $command->notes,
            );

            $saleReturn->process();
            $this->returnRepo->save($saleReturn);

            $saleTotal = $sale->getTotal()->amount;

            if (bccomp($command->refundTotalAmount, $saleTotal, 2) >= 0) {
                $sale->markRefunded();
            } else {
                $sale->markPartiallyRefunded();
            }

            $this->saleRepo->save($sale);

            $receiptLineItems = array_map(
                fn (ReturnLine $rl) => ReceiptLineItem::of(
                    productId: $rl->productId,
                    productName: $rl->productName,
                    sku: $rl->sku,
                    quantityValue: $rl->quantity->value,
                    unitPriceAmount: $rl->unitPrice->amount,
                    lineTotalAmount: $rl->refundAmount->amount,
                    currency: $rl->unitPrice->currency,
                ),
                $returnLines,
            );

            $receiptTotals = ReceiptTotals::of(
                subtotalAmount: $refundTotal->amount,
                discountAmount: '0.00',
                taxAmount: '0.00',
                totalAmount: $refundTotal->amount,
                tenderedAmount: '0.00',
                changeAmount: $refundTotal->amount,
                currency: $command->currency,
            );

            $receiptPayments = [
                ReceiptPayment::of($command->refundMethod, $refundTotal->amount, $command->currency),
            ];

            $receipt = Receipt::issue(
                receiptNumber: $receiptNumber,
                type: ReceiptType::Return,
                originalTransactionId: (string) $saleReturn->id,
                originalTransactionNumber: $returnNumber,
                terminalId: $command->terminalId,
                sessionId: $command->sessionId,
                shiftId: $command->shiftId,
                cashierId: $command->cashierId,
                cashierName: $command->cashierName,
                customerId: $command->customerId,
                customerName: $command->customerName,
                currency: $command->currency,
                lineItems: $receiptLineItems,
                totals: $receiptTotals,
                payments: $receiptPayments,
                issuedAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            );

            $this->receiptRepo->save($receipt);
        });

        $this->publisher->publishAll(array_merge(
            $saleReturn->pullDomainEvents(),
            $sale->pullDomainEvents(),
            $receipt->pullDomainEvents(),
        ));

        return new ProcessReturnResult(
            returnId: (string) $saleReturn->id,
            returnNumber: $saleReturn->return_number,
            receiptId: (string) $receipt->id,
            receiptNumber: $receiptNumber,
            refundAmount: $command->refundTotalAmount,
            currency: $command->currency,
        );
    }
}
