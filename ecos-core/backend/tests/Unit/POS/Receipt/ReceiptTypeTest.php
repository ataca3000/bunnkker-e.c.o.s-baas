<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use Modules\POS\Receipt\Domain\Enums\ReceiptType;
use PHPUnit\Framework\TestCase;

final class ReceiptTypeTest extends TestCase
{
    public function test_cases_have_correct_string_values(): void
    {
        $this->assertSame('sale', ReceiptType::Sale->value);
        $this->assertSame('return', ReceiptType::Return->value);
        $this->assertSame('exchange', ReceiptType::Exchange->value);
    }

    public function test_labels_are_human_readable(): void
    {
        $this->assertSame('Sale', ReceiptType::Sale->label());
        $this->assertSame('Return', ReceiptType::Return->label());
        $this->assertSame('Exchange', ReceiptType::Exchange->label());
    }

    public function test_can_create_from_string_value(): void
    {
        $this->assertSame(ReceiptType::Sale, ReceiptType::from('sale'));
        $this->assertSame(ReceiptType::Return, ReceiptType::from('return'));
        $this->assertSame(ReceiptType::Exchange, ReceiptType::from('exchange'));
    }

    public function test_try_from_returns_null_for_unknown_value(): void
    {
        $this->assertNull(ReceiptType::tryFrom('unknown'));
    }

    public function test_all_cases_have_non_empty_labels(): void
    {
        foreach (ReceiptType::cases() as $case) {
            $this->assertNotEmpty($case->label(), "Label for {$case->name} must not be empty.");
        }
    }
}
