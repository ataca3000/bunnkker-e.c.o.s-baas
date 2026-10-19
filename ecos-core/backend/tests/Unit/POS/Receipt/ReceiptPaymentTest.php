<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use InvalidArgumentException;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptPayment;
use PHPUnit\Framework\TestCase;

final class ReceiptPaymentTest extends TestCase
{
    public function test_rejects_empty_payment_method(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Payment method cannot be empty');

        ReceiptPayment::of('', '100.00', 'EGP');
    }

    public function test_rejects_empty_currency(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Currency cannot be empty');

        ReceiptPayment::of('cash', '100.00', '');
    }

    public function test_currency_is_uppercased(): void
    {
        $payment = ReceiptPayment::of('cash', '100.00', 'egp');

        $this->assertSame('EGP', $payment->currency);
    }

    public function test_reference_defaults_to_null(): void
    {
        $payment = ReceiptPayment::of('cash', '100.00', 'EGP');

        $this->assertNull($payment->reference);
    }

    public function test_reference_is_stored_when_provided(): void
    {
        $payment = ReceiptPayment::of('card', '50.00', 'EGP', '****1234');

        $this->assertSame('****1234', $payment->reference);
    }

    public function test_to_array_has_expected_keys(): void
    {
        $array = ReceiptPayment::of('cash', '100.00', 'EGP')->toArray();

        $this->assertArrayHasKey('payment_method', $array);
        $this->assertArrayHasKey('amount', $array);
        $this->assertArrayHasKey('currency', $array);
        $this->assertArrayHasKey('reference', $array);
    }

    public function test_round_trips_via_array_without_reference(): void
    {
        $original = ReceiptPayment::of('cash', '100.00', 'EGP');
        $restored = ReceiptPayment::fromArray($original->toArray());

        $this->assertSame('cash', $restored->paymentMethod);
        $this->assertSame('100.00', $restored->amount);
        $this->assertSame('EGP', $restored->currency);
        $this->assertNull($restored->reference);
    }

    public function test_round_trips_via_array_with_reference(): void
    {
        $original = ReceiptPayment::of('card', '75.00', 'EGP', '****5678');
        $restored = ReceiptPayment::fromArray($original->toArray());

        $this->assertSame('****5678', $restored->reference);
    }
}
