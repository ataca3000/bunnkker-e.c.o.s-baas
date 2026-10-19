<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Session;

use Modules\POS\Session\Domain\Events\SessionClosed;
use Modules\POS\Session\Domain\Events\SessionOpened;
use Modules\POS\Session\Domain\Events\SessionResumed;
use Modules\POS\Session\Domain\Events\SessionSuspended;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-004: Session domain events unit tests.
 * Tests the DomainEvent contract and payload structure without any infrastructure.
 */
final class SessionDomainEventsTest extends TestCase
{
    private const SESSION_ID = 'session-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    // ── SessionOpened ────────────────────────────────────────────────────────

    public function test_session_opened_implements_domain_event(): void
    {
        $event = $this->makeSessionOpened();

        $this->assertInstanceOf(DomainEvent::class, $event);
    }

    public function test_session_opened_event_name(): void
    {
        $this->assertSame('pos.session.opened', $this->makeSessionOpened()->eventName());
    }

    public function test_session_opened_version_is_one(): void
    {
        $this->assertSame(1, $this->makeSessionOpened()->eventVersion());
    }

    public function test_session_opened_event_id_equals_correlation_id(): void
    {
        $event = $this->makeSessionOpened();

        $this->assertSame($event->eventId(), $event->correlationId());
    }

    public function test_session_opened_occurred_at_is_utc(): void
    {
        $this->assertSame('UTC', $this->makeSessionOpened()->occurredAt()->getTimezone()->getName());
    }

    public function test_session_opened_to_array_contains_required_keys(): void
    {
        $array = $this->makeSessionOpened()->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'session_id', 'terminal_id', 'cashier_id', 'device_fingerprint',
            'device_type', 'ip_address'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    public function test_session_opened_payload_values(): void
    {
        $event = $this->makeSessionOpened();
        $array = $event->toArray();

        $this->assertSame(self::SESSION_ID, $array['session_id']);
        $this->assertSame(self::TERMINAL_ID, $array['terminal_id']);
        $this->assertSame(self::CASHIER_ID, $array['cashier_id']);
        $this->assertSame('fp-hash-abc', $array['device_fingerprint']);
        $this->assertSame('browser', $array['device_type']);
        $this->assertSame('192.168.1.1', $array['ip_address']);
    }

    public function test_two_opened_events_have_different_event_ids(): void
    {
        $e1 = $this->makeSessionOpened();
        $e2 = $this->makeSessionOpened();

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    // ── SessionSuspended ─────────────────────────────────────────────────────

    public function test_session_suspended_implements_domain_event(): void
    {
        $event = SessionSuspended::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID);

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.session.suspended', $event->eventName());
    }

    public function test_session_suspended_event_id_equals_correlation_id(): void
    {
        $event = SessionSuspended::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID);

        $this->assertSame($event->eventId(), $event->correlationId());
    }

    public function test_session_suspended_to_array_contains_required_keys(): void
    {
        $array = SessionSuspended::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID)->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'session_id', 'terminal_id', 'cashier_id'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    // ── SessionResumed ───────────────────────────────────────────────────────

    public function test_session_resumed_implements_domain_event(): void
    {
        $event = SessionResumed::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, true);

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.session.resumed', $event->eventName());
    }

    public function test_session_resumed_carries_same_device_flag(): void
    {
        $sameDevice = SessionResumed::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, true);
        $differentDevice = SessionResumed::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, false);

        $this->assertTrue($sameDevice->toArray()['same_device']);
        $this->assertFalse($differentDevice->toArray()['same_device']);
    }

    public function test_session_resumed_to_array_contains_required_keys(): void
    {
        $array = SessionResumed::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, true)->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'session_id', 'terminal_id', 'cashier_id', 'same_device'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    // ── SessionClosed ────────────────────────────────────────────────────────

    public function test_session_closed_implements_domain_event(): void
    {
        $event = SessionClosed::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, 120);

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.session.closed', $event->eventName());
    }

    public function test_session_closed_carries_duration(): void
    {
        $event = SessionClosed::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, 480);

        $this->assertSame(480, $event->durationMinutes);
        $this->assertSame(480, $event->toArray()['duration_minutes']);
    }

    public function test_session_closed_to_array_contains_required_keys(): void
    {
        $array = SessionClosed::now(self::SESSION_ID, self::TERMINAL_ID, self::CASHIER_ID, 60)->toArray();

        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'session_id', 'terminal_id', 'cashier_id', 'duration_minutes'] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: {$key}");
        }
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeSessionOpened(): SessionOpened
    {
        return SessionOpened::now(
            sessionId: self::SESSION_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            deviceFingerprint: 'fp-hash-abc',
            deviceType: 'browser',
            ipAddress: '192.168.1.1',
        );
    }
}
