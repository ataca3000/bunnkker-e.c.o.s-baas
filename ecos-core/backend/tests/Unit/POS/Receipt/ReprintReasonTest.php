<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use Modules\POS\Receipt\Domain\Enums\ReprintReason;
use PHPUnit\Framework\TestCase;

final class ReprintReasonTest extends TestCase
{
    public function test_cases_have_correct_string_values(): void
    {
        $this->assertSame('customer_request', ReprintReason::CustomerRequest->value);
        $this->assertSame('printer_error', ReprintReason::PrinterError->value);
        $this->assertSame('damaged', ReprintReason::Damaged->value);
        $this->assertSame('other', ReprintReason::Other->value);
    }

    public function test_labels_are_human_readable(): void
    {
        $this->assertSame('Customer Request', ReprintReason::CustomerRequest->label());
        $this->assertSame('Printer Error', ReprintReason::PrinterError->label());
        $this->assertSame('Damaged', ReprintReason::Damaged->label());
        $this->assertSame('Other', ReprintReason::Other->label());
    }

    public function test_all_cases_have_non_empty_labels(): void
    {
        foreach (ReprintReason::cases() as $case) {
            $this->assertNotEmpty($case->label(), "Label for {$case->name} must not be empty.");
        }
    }

    public function test_can_create_from_string_value(): void
    {
        $this->assertSame(ReprintReason::CustomerRequest, ReprintReason::from('customer_request'));
        $this->assertSame(ReprintReason::PrinterError, ReprintReason::from('printer_error'));
    }

    public function test_try_from_returns_null_for_unknown(): void
    {
        $this->assertNull(ReprintReason::tryFrom('lost'));
    }
}
