<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Shift;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Shared\Domain\Enums\ShiftStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;
use Modules\POS\Shift\Domain\Models\Shift;
use Modules\POS\Shift\Domain\ValueObjects\ShiftNumber;
use Tests\TestCase;

/**
 * PKG-POS-005: Shift repository persistence tests.
 *
 * Requires a running PostgreSQL database. These tests verify that the
 * EloquentShiftRepository correctly persists and retrieves shifts,
 * and that all JSONB round-trips survive the database.
 *
 * Run these tests when the database is available:
 *   php artisan test tests/Feature/POS/Shift/ShiftPersistenceTest.php
 */
final class ShiftPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private ShiftRepositoryInterface $repository;

    // No FK constraints on these — any UUID is valid.
    private const SESSION_ID = 'a1000000-0000-4000-a000-000000000001';

    private const TERMINAL_ID = 'b1000000-0000-4000-b000-000000000001';

    private const CASHIER_ID = 'c1000000-0000-4000-c000-000000000001';

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = app(ShiftRepositoryInterface::class);
    }

    private function makeShift(int $number = 1, string $currency = 'EGP'): Shift
    {
        return Shift::open(
            sessionId: self::SESSION_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            openingCash: Money::of('1000.00', $currency),
            shiftNumber: ShiftNumber::of($number),
        );
    }

    // ── Basic CRUD ────────────────────────────────────────────────────────────

    public function test_save_and_find_by_id(): void
    {
        $shift = $this->makeShift();
        $this->repository->save($shift);

        $found = $this->repository->findById($shift->id);

        $this->assertNotNull($found);
        $this->assertSame($shift->id, $found->id);
        $this->assertSame(ShiftStatus::Open, $found->status);
        $this->assertSame(1, $found->shift_number);
    }

    public function test_find_by_id_returns_null_for_unknown(): void
    {
        $found = $this->repository->findById('00000000-0000-0000-0000-000000000000');

        $this->assertNull($found);
    }

    // ── JSONB round-trips ─────────────────────────────────────────────────────

    public function test_opening_cash_round_trips_through_database(): void
    {
        $shift = $this->makeShift(currency: 'USD');
        $this->repository->save($shift);

        $found = $this->repository->findById($shift->id);

        $this->assertNotNull($found);
        $cash = $found->getOpeningCash();
        $this->assertSame('1000.00', $cash->amount);
        $this->assertSame('USD', $cash->currency);
    }

    public function test_closing_count_round_trips_after_submission(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1050.00', 'EGP'));
        $this->repository->save($shift);

        $found = $this->repository->findById($shift->id);

        $this->assertNotNull($found);
        $count = $found->getClosingCount();
        $this->assertNotNull($count);
        $this->assertSame('1050.00', $count->amount);
    }

    public function test_variance_round_trips_after_approval(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1045.00', 'EGP'));
        $shift->approve(Money::of('1050.00', 'EGP'));
        $this->repository->save($shift);

        $found = $this->repository->findById($shift->id);

        $this->assertNotNull($found);
        $variance = $found->getVariance();
        $this->assertNotNull($variance);
        $this->assertSame('-5.00', $variance->amount);
    }

    // ── Open-shift queries ────────────────────────────────────────────────────

    public function test_find_open_by_session_returns_open_shift(): void
    {
        $shift = $this->makeShift();
        $this->repository->save($shift);

        $found = $this->repository->findOpenBySession(self::SESSION_ID);

        $this->assertNotNull($found);
        $this->assertSame($shift->id, $found->id);
    }

    public function test_find_open_by_session_returns_null_when_closed(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));
        $shift->approve(Money::of('1000.00', 'EGP'));
        $this->repository->save($shift);

        $found = $this->repository->findOpenBySession(self::SESSION_ID);

        $this->assertNull($found);
    }

    public function test_find_open_by_session_returns_null_for_unknown_session(): void
    {
        $found = $this->repository->findOpenBySession('d0000000-0000-0000-0000-000000000099');

        $this->assertNull($found);
    }

    // ── countByTerminal ───────────────────────────────────────────────────────

    public function test_count_by_terminal_returns_zero_for_new_terminal(): void
    {
        $this->assertSame(0, $this->repository->countByTerminal(self::TERMINAL_ID));
    }

    public function test_count_by_terminal_increments_with_each_saved_shift(): void
    {
        $this->repository->save($this->makeShift(number: 1));
        $this->repository->save($this->makeShift(number: 2));

        $this->assertSame(2, $this->repository->countByTerminal(self::TERMINAL_ID));
    }

    // ── State change persistence ──────────────────────────────────────────────

    public function test_submit_and_reject_persist_correctly(): void
    {
        $shift = $this->makeShift();
        $this->repository->save($shift);

        $shift->submitForClosure(Money::of('900.00', 'EGP'));
        $this->repository->save($shift);

        $afterSubmit = $this->repository->findById($shift->id);
        $this->assertNotNull($afterSubmit);
        $this->assertSame(ShiftStatus::Closing, $afterSubmit->status);

        $afterSubmit->rejectCount('Too low');
        $this->repository->save($afterSubmit);

        $afterReject = $this->repository->findById($shift->id);
        $this->assertNotNull($afterReject);
        $this->assertSame(ShiftStatus::Closing, $afterReject->status, 'ADR-POS-006: stays Closing');
        $this->assertNull($afterReject->getClosingCount());
        $this->assertSame('Too low', $afterReject->rejection_reason);
    }

    // ── Unique constraint ─────────────────────────────────────────────────────

    public function test_unique_shift_number_per_terminal_is_enforced_by_database(): void
    {
        $first = $this->makeShift(number: 1);
        $this->repository->save($first);

        // Trying to save a second shift with the same number on the same terminal.
        $duplicate = $this->makeShift(number: 1);

        $this->expectException(\Illuminate\Database\QueryException::class);

        $this->repository->save($duplicate);
    }
}
