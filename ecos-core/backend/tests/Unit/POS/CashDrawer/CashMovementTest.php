<?php

declare(strict_types=1);

namespace Tests\Unit\POS\CashDrawer;

use InvalidArgumentException;
use Modules\POS\CashDrawer\Domain\ValueObjects\CashMovement;
use Modules\POS\Shared\Domain\Enums\TransactionType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class CashMovementTest extends TestCase
{
    // ── record() factory ──────────────────────────────────────────────────────

    public function test_record_creates_cash_in_movement(): void
    {
        $amount = Money::of('50.00', 'EGP');
        $movement = CashMovement::record(TransactionType::CashIn, $amount, 'Cash deposit');

        $this->assertSame(TransactionType::CashIn, $movement->type);
        $this->assertTrue($movement->amount->equals($amount));
        $this->assertSame('Cash deposit', $movement->note);
    }

    public function test_record_creates_cash_out_movement(): void
    {
        $amount = Money::of('20.00', 'EGP');
        $movement = CashMovement::record(TransactionType::CashOut, $amount);

        $this->assertSame(TransactionType::CashOut, $movement->type);
        $this->assertTrue($movement->amount->equals($amount));
        $this->assertNull($movement->note);
    }

    public function test_record_generates_unique_uuids(): void
    {
        $a = CashMovement::record(TransactionType::CashIn, Money::of('10.00', 'EGP'));
        $b = CashMovement::record(TransactionType::CashIn, Money::of('10.00', 'EGP'));

        $this->assertNotSame($a->id, $b->id);
    }

    public function test_record_id_is_valid_uuid_v4(): void
    {
        $movement = CashMovement::record(TransactionType::CashIn, Money::of('10.00', 'EGP'));

        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $movement->id,
        );
    }

    public function test_record_sets_recorded_at_in_utc(): void
    {
        $movement = CashMovement::record(TransactionType::CashIn, Money::of('10.00', 'EGP'));

        $this->assertStringContainsString('+00:00', $movement->recordedAt);
    }

    public function test_record_throws_on_zero_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);
        CashMovement::record(TransactionType::CashIn, Money::zero('EGP'));
    }

    public function test_record_throws_on_negative_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);
        CashMovement::record(TransactionType::CashOut, Money::of('-5.00', 'EGP'));
    }

    // ── toArray() ─────────────────────────────────────────────────────────────

    public function test_to_array_contains_required_keys(): void
    {
        $movement = CashMovement::record(TransactionType::CashIn, Money::of('30.00', 'EGP'), 'note');
        $data = $movement->toArray();

        $this->assertArrayHasKey('id', $data);
        $this->assertArrayHasKey('type', $data);
        $this->assertArrayHasKey('amount', $data);
        $this->assertArrayHasKey('note', $data);
        $this->assertArrayHasKey('recorded_at', $data);
    }

    public function test_to_array_serializes_type_as_string(): void
    {
        $movement = CashMovement::record(TransactionType::CashIn, Money::of('30.00', 'EGP'));
        $data = $movement->toArray();

        $this->assertSame('cash_in', $data['type']);
    }

    public function test_to_array_serializes_amount_as_nested_array(): void
    {
        $movement = CashMovement::record(TransactionType::CashOut, Money::of('15.50', 'EGP'));
        $data = $movement->toArray();

        $this->assertArrayHasKey('amount', $data['amount']);
        $this->assertArrayHasKey('currency', $data['amount']);
        $this->assertSame('15.50', $data['amount']['amount']);
        $this->assertSame('EGP', $data['amount']['currency']);
    }

    // ── fromArray() round-trip ────────────────────────────────────────────────

    public function test_from_array_round_trip(): void
    {
        $original = CashMovement::record(TransactionType::CashIn, Money::of('75.00', 'EGP'), 'tip');
        $restored = CashMovement::fromArray($original->toArray());

        $this->assertSame($original->id, $restored->id);
        $this->assertSame($original->type, $restored->type);
        $this->assertTrue($original->amount->equals($restored->amount));
        $this->assertSame($original->note, $restored->note);
        $this->assertSame($original->recordedAt, $restored->recordedAt);
    }

    public function test_from_array_restores_null_note(): void
    {
        $original = CashMovement::record(TransactionType::CashOut, Money::of('10.00', 'EGP'));
        $restored = CashMovement::fromArray($original->toArray());

        $this->assertNull($restored->note);
    }
}
