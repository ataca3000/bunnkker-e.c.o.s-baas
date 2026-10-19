<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Exchange;

use Modules\POS\Exchange\Domain\Enums\ExchangeReason;
use PHPUnit\Framework\TestCase;

final class ExchangeReasonTest extends TestCase
{
    public function test_cases_have_correct_string_values(): void
    {
        $this->assertSame('defective', ExchangeReason::Defective->value);
        $this->assertSame('wrong_item', ExchangeReason::WrongItem->value);
        $this->assertSame('customer_preference', ExchangeReason::CustomerPreference->value);
        $this->assertSame('size_exchange', ExchangeReason::SizeExchange->value);
        $this->assertSame('other', ExchangeReason::Other->value);
    }

    public function test_labels_are_human_readable(): void
    {
        $this->assertSame('Defective Item', ExchangeReason::Defective->label());
        $this->assertSame('Wrong Item Received', ExchangeReason::WrongItem->label());
        $this->assertSame('Customer Preference', ExchangeReason::CustomerPreference->label());
        $this->assertSame('Size Exchange', ExchangeReason::SizeExchange->label());
        $this->assertSame('Other', ExchangeReason::Other->label());
    }

    public function test_only_other_requires_note(): void
    {
        $this->assertFalse(ExchangeReason::Defective->requiresNote());
        $this->assertFalse(ExchangeReason::WrongItem->requiresNote());
        $this->assertFalse(ExchangeReason::CustomerPreference->requiresNote());
        $this->assertFalse(ExchangeReason::SizeExchange->requiresNote());
        $this->assertTrue(ExchangeReason::Other->requiresNote());
    }

    public function test_can_create_from_string_value(): void
    {
        $this->assertSame(ExchangeReason::Defective, ExchangeReason::from('defective'));
        $this->assertSame(ExchangeReason::WrongItem, ExchangeReason::from('wrong_item'));
        $this->assertSame(ExchangeReason::Other, ExchangeReason::from('other'));
    }

    public function test_try_from_returns_null_for_unknown_value(): void
    {
        $this->assertNull(ExchangeReason::tryFrom('unknown'));
    }

    public function test_all_cases_have_non_empty_labels(): void
    {
        foreach (ExchangeReason::cases() as $reason) {
            $this->assertNotEmpty($reason->label());
        }
    }
}
