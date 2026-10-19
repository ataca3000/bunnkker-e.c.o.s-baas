<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Exchange;

use Modules\POS\Exchange\Domain\Enums\ExchangeReason;
use Modules\POS\Exchange\Domain\Models\Exchange;
use Modules\POS\Exchange\Domain\Policies\ExchangeEligibilityPolicy;
use Modules\POS\Exchange\Domain\ValueObjects\ExchangeLine;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

final class ExchangeEligibilityPolicyTest extends TestCase
{
    private ExchangeEligibilityPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->policy = new ExchangeEligibilityPolicy;
    }

    // ── canConfirm() ──────────────────────────────────────────────────────────

    public function test_can_confirm_a_draft_exchange_with_valid_lines(): void
    {
        $exchange = $this->makeDraftExchange();

        $this->assertTrue($this->policy->canConfirm($exchange));
    }

    public function test_cannot_confirm_an_already_confirmed_exchange(): void
    {
        $exchange = $this->makeDraftExchange();
        $exchange->confirm();

        $this->assertFalse($this->policy->canConfirm($exchange));
    }

    public function test_cannot_confirm_a_completed_exchange(): void
    {
        $exchange = $this->makeDraftExchange();
        $exchange->confirm();
        $exchange->complete();

        $this->assertFalse($this->policy->canConfirm($exchange));
    }

    public function test_cannot_confirm_a_cancelled_exchange(): void
    {
        $exchange = $this->makeDraftExchange();
        $exchange->cancel('test');

        $this->assertFalse($this->policy->canConfirm($exchange));
    }

    // ── canComplete() ─────────────────────────────────────────────────────────

    public function test_can_complete_a_confirmed_exchange(): void
    {
        $exchange = $this->makeDraftExchange();
        $exchange->confirm();

        $this->assertTrue($this->policy->canComplete($exchange));
    }

    public function test_cannot_complete_a_draft_exchange(): void
    {
        $exchange = $this->makeDraftExchange();

        $this->assertFalse($this->policy->canComplete($exchange));
    }

    public function test_cannot_complete_a_cancelled_exchange(): void
    {
        $exchange = $this->makeDraftExchange();
        $exchange->cancel();

        $this->assertFalse($this->policy->canComplete($exchange));
    }

    // ── canCancel() ───────────────────────────────────────────────────────────

    public function test_can_cancel_a_draft_exchange(): void
    {
        $this->assertTrue($this->policy->canCancel($this->makeDraftExchange()));
    }

    public function test_can_cancel_a_confirmed_exchange(): void
    {
        $exchange = $this->makeDraftExchange();
        $exchange->confirm();

        $this->assertTrue($this->policy->canCancel($exchange));
    }

    public function test_cannot_cancel_a_completed_exchange(): void
    {
        $exchange = $this->makeDraftExchange();
        $exchange->confirm();
        $exchange->complete();

        $this->assertFalse($this->policy->canCancel($exchange));
    }

    public function test_cannot_cancel_an_already_cancelled_exchange(): void
    {
        $exchange = $this->makeDraftExchange();
        $exchange->cancel();

        $this->assertFalse($this->policy->canCancel($exchange));
    }

    // ── hasValidLines() ───────────────────────────────────────────────────────

    public function test_has_valid_lines_is_true_when_both_sides_have_lines(): void
    {
        $this->assertTrue($this->policy->hasValidLines($this->makeDraftExchange()));
    }

    // ── isCurrencyConsistent() ────────────────────────────────────────────────

    public function test_currency_is_consistent_when_all_lines_match(): void
    {
        $this->assertTrue($this->policy->isCurrencyConsistent($this->makeDraftExchange()));
    }

    public function test_currency_is_consistent_for_any_validly_initiated_exchange(): void
    {
        // Exchange::initiate() enforces currency consistency through sumLines():
        // it adds each line's lineTotal to a running total initialised in the exchange
        // currency, so passing mismatched currencies throws InvalidMoneyOperationException
        // before the aggregate is even constructed.  isCurrencyConsistent() therefore
        // always returns true for exchanges that passed through initiate().
        $exchange = $this->makeDraftExchange();

        $this->assertTrue($this->policy->isCurrencyConsistent($exchange));
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeDraftExchange(): Exchange
    {
        $returned = [
            ExchangeLine::returned('line-01', 'prod-1', 'Blue Shirt S', 'SKU-SHIRT-S', Quantity::of('1'), Money::of('100.00', 'EGP')),
        ];
        $replacements = [
            ExchangeLine::replacement('prod-1', 'Blue Shirt M', 'SKU-SHIRT-M', Quantity::of('1'), Money::of('100.00', 'EGP')),
        ];

        return Exchange::initiate(
            'EXC-001',
            'sale-001', 'SALE-0001',
            'term-1', 'sess-1', 'shift-1', 'cashier-1',
            null, 'EGP',
            $returned, $replacements,
            ExchangeReason::SizeExchange,
        );
    }
}
