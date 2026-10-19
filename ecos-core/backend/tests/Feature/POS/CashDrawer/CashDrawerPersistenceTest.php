<?php

declare(strict_types=1);

namespace Tests\Feature\POS\CashDrawer;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\CashDrawer\Domain\Exceptions\CashDrawerNotFoundException;
use Modules\POS\CashDrawer\Domain\Models\CashDrawer;
use Modules\POS\CashDrawer\Infrastructure\Repositories\EloquentCashDrawerRepository;
use Modules\POS\Shared\Domain\Enums\CashDrawerStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Tests\TestCase;

final class CashDrawerPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private EloquentCashDrawerRepository $repo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repo = new EloquentCashDrawerRepository;
    }

    // ── save / findById ───────────────────────────────────────────────────────

    public function test_save_and_find_by_id(): void
    {
        $drawer = $this->openDrawer();
        $this->repo->save($drawer);

        $found = $this->repo->findById($drawer->id);
        $this->assertSame((string) $drawer->id, (string) $found->id);
        $this->assertSame('EGP', $found->currency);
        $this->assertSame(CashDrawerStatus::Open->value, $found->status);
    }

    public function test_find_by_id_throws_when_not_found(): void
    {
        $this->expectException(CashDrawerNotFoundException::class);
        $this->repo->findById('non-existent-uuid');
    }

    // ── findByShiftId ─────────────────────────────────────────────────────────

    public function test_find_by_shift_id(): void
    {
        $drawer = $this->openDrawer(shiftId: 'shift-aaa');
        $this->repo->save($drawer);

        $found = $this->repo->findByShiftId('shift-aaa');
        $this->assertSame('shift-aaa', $found->shift_id);
    }

    public function test_find_by_shift_id_throws_when_not_found(): void
    {
        $this->expectException(CashDrawerNotFoundException::class);
        $this->repo->findByShiftId('unknown-shift');
    }

    // ── findBySessionId ───────────────────────────────────────────────────────

    public function test_find_by_session_id(): void
    {
        $drawer = $this->openDrawer(sessionId: 'session-bbb');
        $this->repo->save($drawer);

        $found = $this->repo->findBySessionId('session-bbb');
        $this->assertSame('session-bbb', $found->session_id);
    }

    public function test_find_by_session_id_throws_when_not_found(): void
    {
        $this->expectException(CashDrawerNotFoundException::class);
        $this->repo->findBySessionId('unknown-session');
    }

    // ── JSONB round-trips ─────────────────────────────────────────────────────

    public function test_opening_float_persists_as_jsonb(): void
    {
        $float = Money::of('750.00', 'EGP');
        $drawer = $this->openDrawer(openingFloat: $float);
        $this->repo->save($drawer);

        $found = $this->repo->findById($drawer->id);
        $this->assertTrue($float->equals($found->getOpeningFloat()));
    }

    public function test_movements_persist_as_jsonb(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordCashIn(Money::of('100.00', 'EGP'), 'deposit');
        $drawer->recordCashOut(Money::of('30.00', 'EGP'));
        $this->repo->save($drawer);

        $found = $this->repo->findById($drawer->id);
        $this->assertSame(2, $found->getMovementCount());
        $this->assertTrue(Money::of('570.00', 'EGP')->equals($found->getExpectedBalance()));
    }

    public function test_closing_count_persists_as_jsonb(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordClosingCount(Money::of('520.00', 'EGP'));
        $this->repo->save($drawer);

        $found = $this->repo->findById($drawer->id);
        $this->assertTrue(Money::of('520.00', 'EGP')->equals($found->getClosingCount()));
    }

    // ── Status transitions persist ────────────────────────────────────────────

    public function test_closed_status_persists(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordClosingCount(Money::of('500.00', 'EGP'));
        $drawer->close();
        $this->repo->save($drawer);

        $found = $this->repo->findById($drawer->id);
        $this->assertSame(CashDrawerStatus::Closed->value, $found->status);
        $this->assertTrue($found->isClosed());
    }

    public function test_closed_at_timestamp_persists(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordClosingCount(Money::of('500.00', 'EGP'));
        $drawer->close();
        $this->repo->save($drawer);

        $found = $this->repo->findById($drawer->id);
        $this->assertNotNull($found->closed_at);
    }

    // ── UNIQUE constraint: shift_id ───────────────────────────────────────────

    public function test_unique_constraint_on_shift_id(): void
    {
        $this->repo->save($this->openDrawer(shiftId: 'shift-dup'));
        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->repo->save($this->openDrawer(shiftId: 'shift-dup'));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function openDrawer(
        string $terminalId = 'terminal-uuid-001',
        string $sessionId = 'session-uuid-001',
        string $shiftId = 'shift-uuid-001',
        string $cashierId = 'cashier-uuid-001',
        string $currency = 'EGP',
        ?Money $openingFloat = null,
    ): CashDrawer {
        return CashDrawer::open(
            terminalId: $terminalId,
            sessionId: $sessionId,
            shiftId: $shiftId,
            cashierId: $cashierId,
            currency: $currency,
            openingFloat: $openingFloat ?? Money::of('500.00', 'EGP'),
        );
    }
}
