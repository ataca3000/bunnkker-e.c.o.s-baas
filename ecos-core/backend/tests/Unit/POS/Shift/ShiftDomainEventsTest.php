<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Shift;

use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shift\Domain\Events\ShiftApproved;
use Modules\POS\Shift\Domain\Events\ShiftCountRejected;
use Modules\POS\Shift\Domain\Events\ShiftOpened;
use Modules\POS\Shift\Domain\Events\ShiftSubmittedForClosure;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-005: Shift domain events unit tests.
 * Tests the DomainEvent contract and payload structure without any infrastructure.
 */
final class ShiftDomainEventsTest extends TestCase
{
    private const SHIFT_ID = 'shift-uuid-1';

    private const SESSION_ID = 'session-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private const SHIFT_NUM = 3;

    private const CURRENCY = 'EGP';

    // ── ShiftOpened ──────────────────────────────────────────────────────────

    public function test_shift_opened_implements_domain_event(): void
    {
        $event = $this->makeShiftOpened();

        $this->assertInstanceOf(DomainEvent::class, $event);
    }

    public function test_shift_opened_event_name(): void
    {
        $this->assertSame('pos.shift.opened', $this->makeShiftOpened()->eventName());
    }

    public function test_shift_opened_version_is_one(): void
    {
        $this->assertSame(1, $this->makeShiftOpened()->eventVersion());
    }

    public function test_shift_opened_event_id_equals_correlation_id(): void
    {
        $event = $this->makeShiftOpened();

        $this->assertSame($event->eventId(), $event->correlationId());
    }

    public function test_shift_opened_occurred_at_is_utc(): void
    {
        $this->assertSame('UTC', $this->makeShiftOpened()->occurredAt()->getTimezone()->getName());
    }

    public function test_shift_opened_to_array_contains_required_keys(): void
    {
        $array = $this->makeShiftOpened()->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'shift_id', 'session_id', 'terminal_id', 'cashier_id',
            'shift_number', 'opening_cash_amount', 'currency'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    public function test_shift_opened_payload_values(): void
    {
        $event = $this->makeShiftOpened();
        $array = $event->toArray();

        $this->assertSame(self::SHIFT_ID, $array['shift_id']);
        $this->assertSame(self::SHIFT_NUM, $array['shift_number']);
        $this->assertSame('500.00', $array['opening_cash_amount']);
        $this->assertSame(self::CURRENCY, $array['currency']);
    }

    public function test_two_shift_opened_events_have_different_ids(): void
    {
        $e1 = $this->makeShiftOpened();
        $e2 = $this->makeShiftOpened();

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    // ── ShiftSubmittedForClosure ─────────────────────────────────────────────

    public function test_shift_submitted_for_closure_implements_domain_event(): void
    {
        $event = $this->makeSubmitted();

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.shift.submitted_for_closure', $event->eventName());
    }

    public function test_shift_submitted_to_array_contains_required_keys(): void
    {
        $array = $this->makeSubmitted()->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'shift_id', 'session_id', 'terminal_id', 'cashier_id',
            'shift_number', 'closing_count_amount', 'currency'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    public function test_shift_submitted_event_id_equals_correlation_id(): void
    {
        $event = $this->makeSubmitted();

        $this->assertSame($event->eventId(), $event->correlationId());
    }

    // ── ShiftApproved ────────────────────────────────────────────────────────

    public function test_shift_approved_implements_domain_event(): void
    {
        $event = $this->makeApproved();

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.shift.approved', $event->eventName());
    }

    public function test_shift_approved_carries_financial_fields(): void
    {
        $event = $this->makeApproved();

        $this->assertSame('1045.00', $event->closingCountAmount);
        $this->assertSame('1050.00', $event->expectedClosingAmount);
        $this->assertSame('-5.00', $event->varianceAmount);
        $this->assertSame(480, $event->durationMinutes);
    }

    public function test_shift_approved_to_array_contains_required_keys(): void
    {
        $array = $this->makeApproved()->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'shift_id', 'session_id', 'terminal_id', 'cashier_id', 'shift_number',
            'closing_count_amount', 'expected_closing_amount', 'variance_amount',
            'currency', 'duration_minutes'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    // ── ShiftCountRejected ───────────────────────────────────────────────────

    public function test_shift_count_rejected_implements_domain_event(): void
    {
        $event = $this->makeRejected();

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.shift.count_rejected', $event->eventName());
    }

    public function test_shift_count_rejected_carries_reason(): void
    {
        $event = ShiftCountRejected::now(
            self::SHIFT_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID,
            self::SHIFT_NUM, 'Count discrepancy exceeds tolerance',
        );

        $this->assertSame('Count discrepancy exceeds tolerance', $event->reason);
        $this->assertSame('Count discrepancy exceeds tolerance', $event->toArray()['reason']);
    }

    public function test_shift_count_rejected_reason_defaults_to_empty(): void
    {
        $event = $this->makeRejected();

        $this->assertSame('', $event->reason);
    }

    public function test_shift_count_rejected_to_array_contains_required_keys(): void
    {
        $array = $this->makeRejected()->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'shift_id', 'session_id', 'terminal_id', 'cashier_id',
            'shift_number', 'reason'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeShiftOpened(): ShiftOpened
    {
        return ShiftOpened::now(
            self::SHIFT_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID,
            self::SHIFT_NUM, '500.00', self::CURRENCY,
        );
    }

    private function makeSubmitted(): ShiftSubmittedForClosure
    {
        return ShiftSubmittedForClosure::now(
            self::SHIFT_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID,
            self::SHIFT_NUM, '1045.00', self::CURRENCY,
        );
    }

    private function makeApproved(): ShiftApproved
    {
        return ShiftApproved::now(
            self::SHIFT_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID,
            self::SHIFT_NUM, '1045.00', '1050.00', '-5.00', self::CURRENCY, 480,
        );
    }

    private function makeRejected(): ShiftCountRejected
    {
        return ShiftCountRejected::now(
            self::SHIFT_ID, self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID,
            self::SHIFT_NUM,
        );
    }
}
