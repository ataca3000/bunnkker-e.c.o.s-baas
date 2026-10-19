<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Payment;

use InvalidArgumentException;
use Modules\POS\Payment\Domain\ValueObjects\PaymentTender;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-007: PaymentTender value object unit tests.
 * Pure unit tests — no database, no Laravel boot.
 */
final class PaymentTenderTest extends TestCase
{
    private function makeAmount(string $amount = '100.00', string $currency = 'EGP'): Money
    {
        return Money::of($amount, $currency);
    }

    // ── create() ──────────────────────────────────────────────────────────────

    public function test_create_generates_non_empty_id(): void
    {
        $tender = PaymentTender::create(PaymentMethodType::Cash, $this->makeAmount());
        $this->assertNotEmpty($tender->id);
    }

    public function test_two_creates_have_different_ids(): void
    {
        $a = PaymentTender::create(PaymentMethodType::Cash, $this->makeAmount());
        $b = PaymentTender::create(PaymentMethodType::Cash, $this->makeAmount());
        $this->assertNotSame($a->id, $b->id);
    }

    public function test_create_stores_payment_method_type(): void
    {
        $tender = PaymentTender::create(PaymentMethodType::Card, $this->makeAmount());
        $this->assertSame(PaymentMethodType::Card, $tender->type);
    }

    public function test_create_stores_amount(): void
    {
        $amount = $this->makeAmount('250.50');
        $tender = PaymentTender::create(PaymentMethodType::Cash, $amount);
        $this->assertSame('250.50', $tender->amount->amount);
        $this->assertSame('EGP', $tender->amount->currency);
    }

    public function test_create_stores_null_reference_by_default(): void
    {
        $tender = PaymentTender::create(PaymentMethodType::Cash, $this->makeAmount());
        $this->assertNull($tender->reference);
    }

    public function test_create_stores_reference_when_provided(): void
    {
        $tender = PaymentTender::create(PaymentMethodType::Card, $this->makeAmount(), 'AUTH-12345');
        $this->assertSame('AUTH-12345', $tender->reference);
    }

    public function test_create_stores_empty_metadata_by_default(): void
    {
        $tender = PaymentTender::create(PaymentMethodType::Cash, $this->makeAmount());
        $this->assertSame([], $tender->metadata);
    }

    public function test_create_stores_metadata_when_provided(): void
    {
        $metadata = ['last4' => '1234', 'card_brand' => 'Visa'];
        $tender = PaymentTender::create(PaymentMethodType::Card, $this->makeAmount(), null, $metadata);
        $this->assertSame($metadata, $tender->metadata);
    }

    public function test_create_throws_for_zero_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PaymentTender::create(PaymentMethodType::Cash, Money::zero('EGP'));
    }

    public function test_create_throws_for_negative_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PaymentTender::create(PaymentMethodType::Cash, Money::of('-50.00', 'EGP'));
    }

    // ── toArray / fromArray ───────────────────────────────────────────────────

    public function test_to_array_contains_required_keys(): void
    {
        $array = PaymentTender::create(PaymentMethodType::Cash, $this->makeAmount())->toArray();
        foreach (['id', 'type', 'amount', 'reference', 'metadata'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    public function test_to_array_serialises_amount_as_nested_array(): void
    {
        $array = PaymentTender::create(PaymentMethodType::Cash, $this->makeAmount('75.25'))->toArray();
        $this->assertIsArray($array['amount']);
        $this->assertSame('75.25', $array['amount']['amount']);
        $this->assertSame('EGP', $array['amount']['currency']);
    }

    public function test_roundtrip_to_array_from_array(): void
    {
        $original = PaymentTender::create(PaymentMethodType::Card, $this->makeAmount('200.00'), 'AUTH-99');
        $restored = PaymentTender::fromArray($original->toArray());

        $this->assertSame($original->id, $restored->id);
        $this->assertSame(PaymentMethodType::Card, $restored->type);
        $this->assertSame('200.00', $restored->amount->amount);
        $this->assertSame('AUTH-99', $restored->reference);
    }

    public function test_from_array_handles_null_reference(): void
    {
        $tender = PaymentTender::fromArray([
            'id' => 'uuid-x',
            'type' => 'cash',
            'amount' => ['amount' => '50.00', 'currency' => 'EGP'],
            'reference' => null,
            'metadata' => [],
        ]);
        $this->assertNull($tender->reference);
    }
}
