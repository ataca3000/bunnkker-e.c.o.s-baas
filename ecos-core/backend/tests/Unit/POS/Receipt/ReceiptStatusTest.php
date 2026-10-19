<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use Modules\POS\Receipt\Domain\Enums\ReceiptStatus;
use PHPUnit\Framework\TestCase;

final class ReceiptStatusTest extends TestCase
{
    public function test_cases_have_correct_string_values(): void
    {
        $this->assertSame('issued', ReceiptStatus::Issued->value);
        $this->assertSame('voided', ReceiptStatus::Voided->value);
    }

    public function test_labels_are_human_readable(): void
    {
        $this->assertSame('Issued', ReceiptStatus::Issued->label());
        $this->assertSame('Voided', ReceiptStatus::Voided->label());
    }

    public function test_only_issued_is_active(): void
    {
        $this->assertTrue(ReceiptStatus::Issued->isActive());
        $this->assertFalse(ReceiptStatus::Voided->isActive());
    }

    public function test_only_issued_can_be_voided(): void
    {
        $this->assertTrue(ReceiptStatus::Issued->canBeVoided());
        $this->assertFalse(ReceiptStatus::Voided->canBeVoided());
    }

    public function test_can_create_from_string_value(): void
    {
        $this->assertSame(ReceiptStatus::Issued, ReceiptStatus::from('issued'));
        $this->assertSame(ReceiptStatus::Voided, ReceiptStatus::from('voided'));
    }
}
