<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Session;

use InvalidArgumentException;
use Modules\POS\Session\Domain\Enums\DeviceType;
use Modules\POS\Session\Domain\Exceptions\InvalidSessionTransitionException;
use Modules\POS\Session\Domain\Models\Session;
use Modules\POS\Session\Domain\ValueObjects\DeviceFingerprint;
use Modules\POS\Shared\Domain\Enums\SessionStatus;
use Tests\TestCase;

/**
 * PKG-POS-004: Session aggregate invariant tests (in-memory, no DB required).
 */
final class SessionAggregateTest extends TestCase
{
    private const CASHIER_ID = 'cashier-uuid-1';

    private const COMPANY_ID = 'company-uuid-1';

    private const WAREHOUSE_ID = 'warehouse-uuid-1';

    private function makeSession(
        string $cashierId = self::CASHIER_ID,
        string $fingerprint = 'device-fp-001',
        string $ip = '10.0.0.1',
        DeviceType $deviceType = DeviceType::Browser,
    ): Session {
        return Session::open(
            cashierId: $cashierId,
            companyId: self::COMPANY_ID,
            channelId: null,
            warehouseId: self::WAREHOUSE_ID,
            fingerprint: DeviceFingerprint::of($fingerprint),
            ipAddress: $ip,
            deviceType: $deviceType,
        );
    }

    // ── open() ────────────────────────────────────────────────────────────────

    public function test_open_creates_session_with_open_status(): void
    {
        $session = $this->makeSession();

        $this->assertSame(SessionStatus::Open, $session->status);
        $this->assertTrue($session->isOpen());
        $this->assertFalse($session->isClosed());
    }

    public function test_open_stores_cashier_id_and_context(): void
    {
        $session = $this->makeSession();

        $this->assertSame(self::CASHIER_ID, $session->cashier_id);
        $this->assertSame(self::CASHIER_ID, $session->terminal_id); // terminal_id = cashier_id
        $this->assertSame(self::COMPANY_ID, $session->company_id);
        $this->assertSame(self::WAREHOUSE_ID, $session->warehouse_id);
        $this->assertNull($session->channel_id);
    }

    public function test_open_stores_device_fingerprint(): void
    {
        $session = $this->makeSession(fingerprint: 'my-unique-fp');

        $this->assertSame('my-unique-fp', $session->device_fingerprint);
    }

    public function test_open_stores_device_type(): void
    {
        $session = $this->makeSession(deviceType: DeviceType::Agent);

        $this->assertSame(DeviceType::Agent, $session->getDeviceType());
    }

    public function test_open_stores_ip_address(): void
    {
        $session = $this->makeSession(ip: '192.168.100.5');

        $this->assertSame('192.168.100.5', $session->ip_address);
    }

    public function test_open_records_opened_at_timestamp(): void
    {
        $session = $this->makeSession();

        $this->assertNotNull($session->opened_at);
    }

    public function test_open_throws_for_empty_cashier_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Cashier ID cannot be empty');

        Session::open('', self::COMPANY_ID, null, self::WAREHOUSE_ID, DeviceFingerprint::of('fp'), '1.2.3.4');
    }

    public function test_open_throws_for_empty_company_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Company ID cannot be empty');

        Session::open(self::CASHIER_ID, '', null, self::WAREHOUSE_ID, DeviceFingerprint::of('fp'), '1.2.3.4');
    }

    public function test_open_throws_for_empty_warehouse_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Warehouse ID cannot be empty');

        Session::open(self::CASHIER_ID, self::COMPANY_ID, null, '', DeviceFingerprint::of('fp'), '1.2.3.4');
    }

    // ── suspend() ────────────────────────────────────────────────────────────

    public function test_suspend_transitions_open_to_suspended(): void
    {
        $session = $this->makeSession();
        $session->suspend();

        $this->assertSame(SessionStatus::Suspended, $session->status);
    }

    public function test_suspend_records_suspended_at(): void
    {
        $session = $this->makeSession();
        $session->suspend();

        $this->assertNotNull($session->suspended_at);
    }

    public function test_suspend_throws_when_already_suspended(): void
    {
        $session = $this->makeSession();
        $session->suspend();

        $this->expectException(InvalidSessionTransitionException::class);
        $this->expectExceptionMessage('cannot transition from "suspended" to "suspended"');

        $session->suspend();
    }

    public function test_suspend_throws_when_closed(): void
    {
        $session = $this->makeSession();
        $session->close();

        $this->expectException(InvalidSessionTransitionException::class);

        $session->suspend();
    }

    public function test_suspend_throws_when_recovery_pending(): void
    {
        $session = $this->makeSession();
        $session->suspend();
        $session->requestRecovery();

        $this->expectException(InvalidSessionTransitionException::class);

        $session->suspend();
    }

    // ── requestRecovery() ────────────────────────────────────────────────────

    public function test_request_recovery_transitions_suspended_to_recovery_pending(): void
    {
        $session = $this->makeSession();
        $session->suspend();
        $session->requestRecovery();

        $this->assertSame(SessionStatus::RecoveryPending, $session->status);
        $this->assertTrue($session->status->requiresSupervisorReview());
    }

    public function test_request_recovery_throws_when_open(): void
    {
        $session = $this->makeSession();

        $this->expectException(InvalidSessionTransitionException::class);
        $this->expectExceptionMessage('cannot transition from "open" to "recovery_pending"');

        $session->requestRecovery();
    }

    public function test_request_recovery_throws_when_closed(): void
    {
        $session = $this->makeSession();
        $session->close();

        $this->expectException(InvalidSessionTransitionException::class);

        $session->requestRecovery();
    }

    public function test_request_recovery_throws_when_already_recovery_pending(): void
    {
        $session = $this->makeSession();
        $session->suspend();
        $session->requestRecovery();

        $this->expectException(InvalidSessionTransitionException::class);

        $session->requestRecovery();
    }

    // ── resume() ─────────────────────────────────────────────────────────────

    public function test_resume_transitions_suspended_to_open(): void
    {
        $session = $this->makeSession();
        $session->suspend();
        $session->resume();

        $this->assertSame(SessionStatus::Open, $session->status);
    }

    public function test_resume_transitions_recovery_pending_to_open(): void
    {
        $session = $this->makeSession();
        $session->suspend();
        $session->requestRecovery();
        $session->resume();

        $this->assertSame(SessionStatus::Open, $session->status);
    }

    public function test_resume_clears_suspended_at(): void
    {
        $session = $this->makeSession();
        $session->suspend();

        $this->assertNotNull($session->suspended_at);

        $session->resume();

        $this->assertNull($session->suspended_at);
    }

    public function test_resume_throws_when_open(): void
    {
        $session = $this->makeSession();

        $this->expectException(InvalidSessionTransitionException::class);
        $this->expectExceptionMessage('cannot transition from "open" to "open"');

        $session->resume();
    }

    public function test_resume_throws_when_closed(): void
    {
        $session = $this->makeSession();
        $session->close();

        $this->expectException(InvalidSessionTransitionException::class);

        $session->resume();
    }

    // ── close() ───────────────────────────────────────────────────────────────

    public function test_close_transitions_open_to_closed(): void
    {
        $session = $this->makeSession();
        $session->close();

        $this->assertSame(SessionStatus::Closed, $session->status);
        $this->assertTrue($session->isClosed());
        $this->assertFalse($session->isOpen());
    }

    public function test_close_transitions_suspended_to_closed(): void
    {
        $session = $this->makeSession();
        $session->suspend();
        $session->close();

        $this->assertSame(SessionStatus::Closed, $session->status);
    }

    public function test_close_transitions_recovery_pending_to_closed(): void
    {
        $session = $this->makeSession();
        $session->suspend();
        $session->requestRecovery();
        $session->close();

        $this->assertSame(SessionStatus::Closed, $session->status);
    }

    public function test_close_records_closed_at(): void
    {
        $session = $this->makeSession();
        $session->close();

        $this->assertNotNull($session->closed_at);
    }

    public function test_close_throws_when_already_closed(): void
    {
        $session = $this->makeSession();
        $session->close();

        $this->expectException(InvalidSessionTransitionException::class);
        $this->expectExceptionMessage('already in state "closed"');

        $session->close();
    }

    // ── Device fingerprint ────────────────────────────────────────────────────

    public function test_get_device_fingerprint_returns_vo(): void
    {
        $session = $this->makeSession(fingerprint: 'test-fp-999');

        $fp = $session->getDeviceFingerprint();

        $this->assertInstanceOf(DeviceFingerprint::class, $fp);
        $this->assertSame('test-fp-999', $fp->value);
    }

    public function test_is_same_device_returns_true_for_matching_fingerprint(): void
    {
        $session = $this->makeSession(fingerprint: 'device-fp-aaa');
        $other = DeviceFingerprint::of('device-fp-aaa');

        $this->assertTrue($session->isSameDevice($other));
    }

    public function test_is_same_device_returns_false_for_different_fingerprint(): void
    {
        $session = $this->makeSession(fingerprint: 'device-fp-aaa');
        $otherDevice = DeviceFingerprint::of('device-fp-bbb');

        $this->assertFalse($session->isSameDevice($otherDevice));
    }

    // ── canTransact / isActive helpers ────────────────────────────────────────

    public function test_can_transact_true_only_when_open(): void
    {
        $session = $this->makeSession();
        $this->assertTrue($session->canTransact(), 'Open');

        $session->suspend();
        $this->assertFalse($session->canTransact(), 'Suspended');

        $session->requestRecovery();
        $this->assertFalse($session->canTransact(), 'RecoveryPending');

        $session->resume();
        $this->assertTrue($session->canTransact(), 'Reopened');

        $session->close();
        $this->assertFalse($session->canTransact(), 'Closed');
    }

    public function test_is_active_true_for_non_closed_states(): void
    {
        $session = $this->makeSession();
        $this->assertTrue($session->isActive(), 'Open');

        $session->suspend();
        $this->assertTrue($session->isActive(), 'Suspended');

        $session->requestRecovery();
        $this->assertTrue($session->isActive(), 'RecoveryPending');

        $session->resume();
        $this->assertTrue($session->isActive(), 'Reopened Open');

        $session->close();
        $this->assertFalse($session->isActive(), 'Closed');
    }

    // ── Full lifecycle ────────────────────────────────────────────────────────

    public function test_full_lifecycle_open_suspend_recover_resume_close(): void
    {
        $session = $this->makeSession();

        $this->assertSame(SessionStatus::Open, $session->status);

        $session->suspend();
        $this->assertSame(SessionStatus::Suspended, $session->status);

        $session->requestRecovery();
        $this->assertSame(SessionStatus::RecoveryPending, $session->status);

        $session->resume();
        $this->assertSame(SessionStatus::Open, $session->status);
        $this->assertNull($session->suspended_at);

        $session->close();
        $this->assertSame(SessionStatus::Closed, $session->status);
    }
}
