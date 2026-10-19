<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Sale;

use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-008: PaymentSummaryLine value object unit tests.
 * Pure unit tests — no database, no Laravel boot.
 */
final class PaymentSummaryLineTest extends TestCase
{
    private function makeTenderData(
        string $type = 'cash',
        string $amount = '100.00',
        string $currency = 'EGP',
        ?string $reference = null,
    ): array {
        return [
            'id' => 'tender-uuid-1',
            'type' => $type,
            'amount' => ['amount' => $amount, 'currency' => $currency],
            'reference' => $reference,
            'metadata' => [],
        ];
    }

    // ── fromTender() ──────────────────────────────────────────────────────────

    public function test_from_tender_creates_with_correct_type(): void
    {
        $summary = PaymentSummaryLine::fromTender($this->makeTenderData(type: 'card'));
        $this->assertSame(PaymentMethodType::Card, $summary->type);
    }

    public function test_from_tender_creates_with_correct_amount(): void
    {
        $summary = PaymentSummaryLine::fromTender($this->makeTenderData(amount: '75.50'));
        $this->assertSame('75.50', $summary->amount->amount);
        $this->assertSame('EGP', $summary->amount->currency);
    }

    public function test_from_tender_stores_reference_when_provided(): void
    {
        $summary = PaymentSummaryLine::fromTender($this->makeTenderData(reference: 'AUTH-9876'));
        $this->assertSame('AUTH-9876', $summary->reference);
    }

    public function test_from_tender_handles_null_reference(): void
    {
        $summary = PaymentSummaryLine::fromTender($this->makeTenderData());
        $this->assertNull($summary->reference);
    }

    // ── toArray() ─────────────────────────────────────────────────────────────

    public function test_to_array_contains_required_keys(): void
    {
        $array = PaymentSummaryLine::fromTender($this->makeTenderData())->toArray();
        foreach (['type', 'amount', 'reference'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    public function test_to_array_serialises_amount_as_nested_array(): void
    {
        $array = PaymentSummaryLine::fromTender($this->makeTenderData(amount: '200.00'))->toArray();
        $this->assertIsArray($array['amount']);
        $this->assertSame('200.00', $array['amount']['amount']);
        $this->assertSame('EGP', $array['amount']['currency']);
    }

    public function test_to_array_serialises_type_as_string(): void
    {
        $array = PaymentSummaryLine::fromTender($this->makeTenderData(type: 'cash'))->toArray();
        $this->assertSame('cash', $array['type']);
    }

    // ── fromArray / roundtrip ─────────────────────────────────────────────────

    public function test_roundtrip_to_array_from_array(): void
    {
        $original = PaymentSummaryLine::fromTender($this->makeTenderData(
            type: 'card',
            amount: '150.00',
            reference: 'AUTH-5555',
        ));

        $restored = PaymentSummaryLine::fromArray($original->toArray());

        $this->assertSame(PaymentMethodType::Card, $restored->type);
        $this->assertSame('150.00', $restored->amount->amount);
        $this->assertSame('AUTH-5555', $restored->reference);
    }

    public function test_from_array_handles_null_reference(): void
    {
        $summary = PaymentSummaryLine::fromArray([
            'type' => 'cash',
            'amount' => ['amount' => '50.00', 'currency' => 'EGP'],
            'reference' => null,
        ]);

        $this->assertNull($summary->reference);
    }
}
