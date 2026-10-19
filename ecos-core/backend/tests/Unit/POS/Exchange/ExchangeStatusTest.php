<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Exchange;

use Modules\POS\Exchange\Domain\Enums\ExchangeStatus;
use PHPUnit\Framework\TestCase;

final class ExchangeStatusTest extends TestCase
{
    public function test_cases_have_correct_string_values(): void
    {
        $this->assertSame('draft', ExchangeStatus::Draft->value);
        $this->assertSame('confirmed', ExchangeStatus::Confirmed->value);
        $this->assertSame('completed', ExchangeStatus::Completed->value);
        $this->assertSame('cancelled', ExchangeStatus::Cancelled->value);
    }

    public function test_labels_are_human_readable(): void
    {
        $this->assertSame('Draft', ExchangeStatus::Draft->label());
        $this->assertSame('Confirmed', ExchangeStatus::Confirmed->label());
        $this->assertSame('Completed', ExchangeStatus::Completed->label());
        $this->assertSame('Cancelled', ExchangeStatus::Cancelled->label());
    }

    public function test_only_completed_and_cancelled_are_terminal(): void
    {
        $this->assertFalse(ExchangeStatus::Draft->isTerminal());
        $this->assertFalse(ExchangeStatus::Confirmed->isTerminal());
        $this->assertTrue(ExchangeStatus::Completed->isTerminal());
        $this->assertTrue(ExchangeStatus::Cancelled->isTerminal());
    }

    public function test_can_be_confirmed_only_from_draft(): void
    {
        $this->assertTrue(ExchangeStatus::Draft->canBeConfirmed());
        $this->assertFalse(ExchangeStatus::Confirmed->canBeConfirmed());
        $this->assertFalse(ExchangeStatus::Completed->canBeConfirmed());
        $this->assertFalse(ExchangeStatus::Cancelled->canBeConfirmed());
    }

    public function test_can_be_completed_only_from_confirmed(): void
    {
        $this->assertFalse(ExchangeStatus::Draft->canBeCompleted());
        $this->assertTrue(ExchangeStatus::Confirmed->canBeCompleted());
        $this->assertFalse(ExchangeStatus::Completed->canBeCompleted());
        $this->assertFalse(ExchangeStatus::Cancelled->canBeCompleted());
    }

    public function test_can_be_cancelled_from_non_terminal_states(): void
    {
        $this->assertTrue(ExchangeStatus::Draft->canBeCancelled());
        $this->assertTrue(ExchangeStatus::Confirmed->canBeCancelled());
        $this->assertFalse(ExchangeStatus::Completed->canBeCancelled());
        $this->assertFalse(ExchangeStatus::Cancelled->canBeCancelled());
    }

    public function test_can_create_from_string_value(): void
    {
        $this->assertSame(ExchangeStatus::Draft, ExchangeStatus::from('draft'));
        $this->assertSame(ExchangeStatus::Confirmed, ExchangeStatus::from('confirmed'));
        $this->assertSame(ExchangeStatus::Completed, ExchangeStatus::from('completed'));
        $this->assertSame(ExchangeStatus::Cancelled, ExchangeStatus::from('cancelled'));
    }

    public function test_try_from_returns_null_for_unknown_value(): void
    {
        $this->assertNull(ExchangeStatus::tryFrom('unknown'));
        $this->assertNull(ExchangeStatus::tryFrom(''));
    }
}
