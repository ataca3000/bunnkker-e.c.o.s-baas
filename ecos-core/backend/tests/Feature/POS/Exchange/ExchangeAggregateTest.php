<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Exchange;

use InvalidArgumentException;
use Modules\POS\Exchange\Domain\Enums\ExchangeReason;
use Modules\POS\Exchange\Domain\Enums\ExchangeStatus;
use Modules\POS\Exchange\Domain\Events\ExchangeCancelled;
use Modules\POS\Exchange\Domain\Events\ExchangeCompleted;
use Modules\POS\Exchange\Domain\Events\ExchangeConfirmed;
use Modules\POS\Exchange\Domain\Events\ExchangeInitiated;
use Modules\POS\Exchange\Domain\Exceptions\InvalidExchangeTransitionException;
use Modules\POS\Exchange\Domain\Models\Exchange;
use Modules\POS\Exchange\Domain\ValueObjects\ExchangeLine;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

final class ExchangeAggregateTest extends TestCase
{
    // ── initiate() guards ────────────────────────────────────────────────────

    public function test_rejects_empty_exchange_number(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Exchange number cannot be empty');

        $this->makeExchange(exchangeNumber: '');
    }

    public function test_rejects_empty_original_sale_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Original sale ID cannot be empty');

        $this->makeExchange(originalSaleId: '');
    }

    public function test_rejects_empty_original_sale_number(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Original sale number cannot be empty');

        $this->makeExchange(originalSaleNumber: '');
    }

    public function test_rejects_empty_terminal_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Terminal ID cannot be empty');

        $this->makeExchange(terminalId: '');
    }

    public function test_rejects_empty_cashier_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Cashier ID cannot be empty');

        $this->makeExchange(cashierId: '');
    }

    public function test_rejects_empty_returned_lines(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('at least one returned line');

        $this->makeExchange(returnedLines: []);
    }

    public function test_rejects_empty_replacement_lines(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('at least one replacement line');

        $this->makeExchange(replacementLines: []);
    }

    public function test_rejects_non_instance_returned_line(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('ExchangeLine instance');

        $this->makeExchange(returnedLines: ['not-an-exchange-line']);
    }

    public function test_rejects_non_instance_replacement_line(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('ExchangeLine instance');

        $this->makeExchange(replacementLines: ['not-an-exchange-line']);
    }

    // ── successful initiation ─────────────────────────────────────────────────

    public function test_initiate_creates_draft_status(): void
    {
        $exchange = $this->makeExchange();

        $this->assertSame(ExchangeStatus::Draft, $exchange->getStatus());
        $this->assertTrue($exchange->isDraft());
    }

    public function test_initiate_assigns_uuid(): void
    {
        $exchange = $this->makeExchange();

        $this->assertNotNull($exchange->id);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            (string) $exchange->id,
        );
    }

    public function test_initiate_stores_lines(): void
    {
        $exchange = $this->makeExchange();

        $this->assertCount(1, $exchange->getReturnedLines());
        $this->assertCount(1, $exchange->getReplacementLines());
    }

    public function test_initiate_fires_exchange_initiated_event(): void
    {
        $exchange = $this->makeExchange();
        $events = $exchange->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(ExchangeInitiated::class, $events[0]);
    }

    public function test_pull_domain_events_clears_queue(): void
    {
        $exchange = $this->makeExchange();
        $exchange->pullDomainEvents();

        $this->assertEmpty($exchange->pullDomainEvents());
    }

    // ── totals and value difference ───────────────────────────────────────────

    public function test_returned_total_sums_returned_lines(): void
    {
        $exchange = $this->makeExchange(returnPrice: '100.00', replacementPrice: '120.00');

        $this->assertSame('100.00', $exchange->getReturnedTotal()->amount);
        $this->assertSame('EGP', $exchange->getReturnedTotal()->currency);
    }

    public function test_replacement_total_sums_replacement_lines(): void
    {
        $exchange = $this->makeExchange(returnPrice: '100.00', replacementPrice: '120.00');

        $this->assertSame('120.00', $exchange->getReplacementTotal()->amount);
    }

    public function test_value_difference_is_replacement_minus_returned(): void
    {
        $exchange = $this->makeExchange(returnPrice: '100.00', replacementPrice: '120.00');

        $this->assertSame('20.00', $exchange->getValueDifference()->amount);
    }

    public function test_value_difference_is_negative_when_returned_exceeds_replacement(): void
    {
        $exchange = $this->makeExchange(returnPrice: '150.00', replacementPrice: '100.00');

        $this->assertSame('-50.00', $exchange->getValueDifference()->amount);
    }

    public function test_value_difference_is_zero_for_equal_value_exchange(): void
    {
        $exchange = $this->makeExchange(returnPrice: '100.00', replacementPrice: '100.00');

        $this->assertSame('0.00', $exchange->getValueDifference()->amount);
    }

    // ── confirm() ─────────────────────────────────────────────────────────────

    public function test_confirm_transitions_to_confirmed(): void
    {
        $exchange = $this->makeExchange();
        $exchange->confirm();

        $this->assertSame(ExchangeStatus::Confirmed, $exchange->getStatus());
        $this->assertTrue($exchange->isConfirmed());
    }

    public function test_confirm_fires_exchange_confirmed_event(): void
    {
        $exchange = $this->makeExchange();
        $exchange->pullDomainEvents(); // clear initiation event

        $exchange->confirm();
        $events = $exchange->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(ExchangeConfirmed::class, $events[0]);
    }

    public function test_confirm_throws_when_not_in_draft(): void
    {
        $exchange = $this->makeExchange();
        $exchange->confirm();

        $this->expectException(InvalidExchangeTransitionException::class);

        $exchange->confirm();
    }

    public function test_confirm_throws_when_completed(): void
    {
        $exchange = $this->makeExchange();
        $exchange->confirm();
        $exchange->complete();

        $this->expectException(InvalidExchangeTransitionException::class);

        $exchange->confirm();
    }

    // ── complete() ────────────────────────────────────────────────────────────

    public function test_complete_transitions_to_completed(): void
    {
        $exchange = $this->makeExchange();
        $exchange->confirm();
        $exchange->complete();

        $this->assertSame(ExchangeStatus::Completed, $exchange->getStatus());
        $this->assertTrue($exchange->isCompleted());
    }

    public function test_complete_fires_exchange_completed_event(): void
    {
        $exchange = $this->makeExchange();
        $exchange->confirm();
        $exchange->pullDomainEvents(); // clear

        $exchange->complete();
        $events = $exchange->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(ExchangeCompleted::class, $events[0]);
    }

    public function test_complete_throws_when_still_draft(): void
    {
        $exchange = $this->makeExchange();

        $this->expectException(InvalidExchangeTransitionException::class);
        $this->expectExceptionMessage('Draft');

        $exchange->complete();
    }

    public function test_complete_throws_when_already_cancelled(): void
    {
        $exchange = $this->makeExchange();
        $exchange->cancel();

        $this->expectException(InvalidExchangeTransitionException::class);

        $exchange->complete();
    }

    // ── cancel() ──────────────────────────────────────────────────────────────

    public function test_cancel_transitions_draft_to_cancelled(): void
    {
        $exchange = $this->makeExchange();
        $exchange->cancel('Changed mind');

        $this->assertSame(ExchangeStatus::Cancelled, $exchange->getStatus());
        $this->assertTrue($exchange->isCancelled());
    }

    public function test_cancel_transitions_confirmed_to_cancelled(): void
    {
        $exchange = $this->makeExchange();
        $exchange->confirm();
        $exchange->cancel('Out of stock');

        $this->assertTrue($exchange->isCancelled());
    }

    public function test_cancel_fires_exchange_cancelled_event(): void
    {
        $exchange = $this->makeExchange();
        $exchange->pullDomainEvents();

        $exchange->cancel('Test reason');
        $events = $exchange->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(ExchangeCancelled::class, $events[0]);
    }

    public function test_cancel_event_records_previous_status(): void
    {
        $exchange = $this->makeExchange();
        $exchange->confirm();
        $exchange->pullDomainEvents();

        $exchange->cancel();
        $events = $exchange->pullDomainEvents();

        /** @var ExchangeCancelled $event */
        $event = $events[0];
        $this->assertSame('confirmed', $event->cancelledFromStatus);
    }

    public function test_cancel_throws_when_already_completed(): void
    {
        $exchange = $this->makeExchange();
        $exchange->confirm();
        $exchange->complete();

        $this->expectException(InvalidExchangeTransitionException::class);
        $this->expectExceptionMessage('Completed');

        $exchange->cancel();
    }

    public function test_cancel_throws_when_already_cancelled(): void
    {
        $exchange = $this->makeExchange();
        $exchange->cancel();

        $this->expectException(InvalidExchangeTransitionException::class);

        $exchange->cancel();
    }

    // ── currency enforcement ──────────────────────────────────────────────────

    public function test_initiate_throws_when_line_currency_does_not_match_exchange_currency(): void
    {
        // sumLines() initialises the running total in the exchange currency and adds
        // each line's lineTotal; mismatched currencies throw before the aggregate is built.
        $this->expectException(\Modules\POS\Shared\Domain\Exceptions\InvalidMoneyOperationException::class);

        Exchange::initiate(
            'EXC-CURR',
            'sale-1', 'SALE-001',
            'term-1', 'sess-1', 'shift-1', 'cashier-1',
            null, 'EGP',
            [ExchangeLine::returned('l1', 'p1', 'Item A', 'SKU-A', Quantity::of('1'), Money::of('100.00', 'EGP'))],
            [ExchangeLine::replacement('p2', 'Item B', 'SKU-B', Quantity::of('1'), Money::of('100.00', 'USD'))],
            ExchangeReason::WrongItem,
        );
    }

    // ── currency normalization ────────────────────────────────────────────────

    public function test_currency_is_uppercased(): void
    {
        $exchange = $this->makeExchange(currency: 'egp');

        $this->assertSame('EGP', $exchange->currency);
    }

    // ── getters ───────────────────────────────────────────────────────────────

    public function test_get_returned_line_count(): void
    {
        $returned = [
            ExchangeLine::returned('l1', 'p1', 'Item A', 'SKU-A', Quantity::of('1'), Money::of('100.00', 'EGP')),
            ExchangeLine::returned('l2', 'p2', 'Item B', 'SKU-B', Quantity::of('2'), Money::of('50.00', 'EGP')),
        ];

        $exchange = $this->makeExchange(returnedLines: $returned);

        $this->assertSame(2, $exchange->getReturnedLineCount());
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeExchange(
        string $exchangeNumber = 'EXC-001',
        string $originalSaleId = 'sale-001',
        string $originalSaleNumber = 'SALE-0001',
        string $terminalId = 'term-1',
        string $cashierId = 'usr-1',
        string $currency = 'EGP',
        string $returnPrice = '100.00',
        string $replacementPrice = '100.00',
        ?array $returnedLines = null,
        ?array $replacementLines = null,
    ): Exchange {
        $returned = $returnedLines ?? [
            ExchangeLine::returned('line-01', 'prod-1', 'Blue Shirt S', 'SKU-S', Quantity::of('1'), Money::of($returnPrice, 'EGP')),
        ];
        $replacements = $replacementLines ?? [
            ExchangeLine::replacement('prod-1', 'Blue Shirt M', 'SKU-M', Quantity::of('1'), Money::of($replacementPrice, 'EGP')),
        ];

        return Exchange::initiate(
            $exchangeNumber,
            $originalSaleId,
            $originalSaleNumber,
            $terminalId,
            'sess-1',
            'shift-1',
            $cashierId,
            null,
            $currency,
            $returned,
            $replacements,
            ExchangeReason::SizeExchange,
        );
    }
}
