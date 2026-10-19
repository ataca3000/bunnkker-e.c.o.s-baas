<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Commands\ProcessSaleCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Exceptions\CartNotFoundException;
use Modules\POS\Application\Exceptions\CartNotReadyException;
use Modules\POS\Application\Results\ProcessSaleResult;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Domain\ValueObjects\ReceiptNumber;
use Modules\POS\Payment\Domain\Contracts\PaymentRepositoryInterface;
use Modules\POS\Payment\Domain\Models\Payment;
use Modules\POS\Receipt\Domain\Contracts\ReceiptNumberingStrategyInterface;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Receipt\Domain\Enums\ReceiptType;
use Modules\POS\Receipt\Domain\Models\Receipt;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptLineItem;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptPayment;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptTotals;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Sale\Domain\Models\Sale;
use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final class ProcessSaleService
{
    public function __construct(
        private readonly CartRepositoryInterface $cartRepo,
        private readonly PaymentRepositoryInterface $paymentRepo,
        private readonly SaleRepositoryInterface $saleRepo,
        private readonly ReceiptRepositoryInterface $receiptRepo,
        private readonly ReceiptNumberingStrategyInterface $receiptNumbering,
        private readonly DomainEventPublisherInterface $publisher,
        private readonly SessionRepositoryInterface $sessionRepo,
    ) {}

    public function execute(ProcessSaleCommand $command): ProcessSaleResult
    {
        $cart = $this->cartRepo->findById($command->cartId);

        if ($cart === null) {
            throw CartNotFoundException::withId($command->cartId);
        }

        if (! $cart->isActive() && ! $cart->isPaying()) {
            throw CartNotReadyException::notActive($command->cartId, $cart->status->value);
        }

        $sale = null;
        $receipt = null;
        $payment = null;
        $receiptNumber = null;

        DB::transaction(function () use ($command, $cart, &$sale, &$receipt, &$payment, &$receiptNumber) {
            $receiptNumber = $this->receiptNumbering->next(
                $command->terminalId,
                new DateTimeImmutable('now', new DateTimeZone('UTC')),
            );

            if ($cart->isActive()) {
                $cart->initiatePayment();
            }

            $payment = Payment::initiate(
                cartId: (string) $cart->id,
                sessionId: $command->sessionId,
                shiftId: $command->shiftId,
                terminalId: $command->terminalId,
                cashierId: $command->cashierId,
                cartTotal: $cart->getTotal(),
            );

            foreach ($command->payments as $tender) {
                $payment->addTender(
                    type: PaymentMethodType::from($tender['type']),
                    amount: Money::of($tender['amount'], $tender['currency']),
                    reference: $tender['reference'] ?? null,
                );
            }

            $payment->capture();
            $this->paymentRepo->save($payment);

            $cartLines = $cart->getLines();

            $saleLines = array_map(
                fn ($line) => SaleLine::fromCartLine($line->toArray()),
                $cartLines,
            );

            $paymentSummaries = array_map(
                fn ($tender) => PaymentSummaryLine::fromTender($tender->toArray()),
                $payment->getTenders(),
            );

            $sale = Sale::record(
                cartId: (string) $cart->id,
                paymentId: (string) $payment->id,
                sessionId: $command->sessionId,
                shiftId: $command->shiftId,
                terminalId: $command->terminalId,
                cashierId: $command->cashierId,
                customerId: $command->customerId,
                currency: $command->currency,
                receiptNumber: $receiptNumber,
                lines: $saleLines,
                subtotal: $cart->getSubtotal(),
                discountTotal: $cart->getDiscountTotal(),
                total: $cart->getTotal(),
                amountPaid: $payment->getAmountTendered(),
                changeGiven: $payment->getChangeDue(),
                paymentSummaries: $paymentSummaries,
            );

            $sale->complete();
            $this->saleRepo->save($sale);

            $cart->complete(ReceiptNumber::of($receiptNumber));
            $this->cartRepo->save($cart);

            $receiptLineItems = array_map(
                fn (SaleLine $sl) => ReceiptLineItem::of(
                    productId: $sl->productId,
                    productName: $sl->productName,
                    sku: $sl->sku,
                    quantityValue: $sl->quantity->value,
                    unitPriceAmount: $sl->unitPrice->amount,
                    lineTotalAmount: $sl->lineTotal->amount,
                    currency: $sl->lineTotal->currency,
                ),
                $saleLines,
            );

            $receiptPayments = array_map(
                fn ($tender) => ReceiptPayment::of(
                    $tender->type->value,
                    $tender->amount->amount,
                    $tender->amount->currency,
                ),
                $payment->getTenders(),
            );

            $receiptTotals = ReceiptTotals::of(
                subtotalAmount: $cart->getSubtotal()->amount,
                discountAmount: $cart->getDiscountTotal()->amount,
                taxAmount: '0.00',
                totalAmount: $cart->getTotal()->amount,
                tenderedAmount: $payment->getAmountTendered()->amount,
                changeAmount: $payment->getChangeDue()->amount,
                currency: $command->currency,
            );

            $receipt = Receipt::issue(
                receiptNumber: $receiptNumber,
                type: ReceiptType::Sale,
                originalTransactionId: (string) $sale->id,
                originalTransactionNumber: $sale->receipt_number,
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

        $domainEvents = array_merge(
            $payment->pullDomainEvents(),
            $sale->pullDomainEvents(),
            $cart->pullDomainEvents(),
            $receipt->pullDomainEvents(),
        );

        // Resolve company + warehouse from the session record — no terminal lookup needed.
        $session = $this->sessionRepo->findById($command->sessionId);

        if ($session === null || $session->warehouse_id === null || $session->company_id === null) {
            Log::channel('daily')->warning('[POS] Session context incomplete — SaleFinalized will NOT be published', [
                'sale_id' => (string) $sale->id,
                'session_id' => $command->sessionId,
            ]);

            $this->publisher->publishAll($domainEvents);

            return new ProcessSaleResult(
                saleId: (string) $sale->id,
                receiptId: (string) $receipt->id,
                receiptNumber: $receiptNumber,
                totalAmount: $sale->getTotal()->amount,
                amountPaid: $sale->getAmountPaid()->amount,
                changeGiven: $sale->getChangeGiven()->amount,
                currency: $sale->currency,
            );
        }

        $saleFinalized = SaleFinalized::fromSaleContext(
            saleId: (string) $sale->id,
            receiptNumber: $receiptNumber,
            companyId: (string) $session->company_id,
            channelId: $session->channel_id ? (string) $session->channel_id : null,
            warehouseId: (string) $session->warehouse_id,
            sessionId: $command->sessionId,
            shiftId: $command->shiftId,
            terminalId: $command->terminalId,
            cashierId: $command->cashierId,
            customerId: $command->customerId,
            saleLines: $sale->getLines(),
            paymentSummaries: $sale->getPaymentSummaries(),
            subtotal: $sale->getSubtotal()->amount,
            discountTotal: $sale->getDiscountTotal()->amount,
            grandTotal: $sale->getTotal()->amount,
            amountPaid: $sale->getAmountPaid()->amount,
            changeGiven: $sale->getChangeGiven()->amount,
            currency: $sale->currency,
        );

        $this->publisher->publishAll(array_merge($domainEvents, [$saleFinalized]));

        return new ProcessSaleResult(
            saleId: (string) $sale->id,
            receiptId: (string) $receipt->id,
            receiptNumber: $receiptNumber,
            totalAmount: $sale->getTotal()->amount,
            amountPaid: $sale->getAmountPaid()->amount,
            changeGiven: $sale->getChangeGiven()->amount,
            currency: $sale->currency,
        );
    }
}
