<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Domain\Enums\DeviceType;
use Modules\POS\Session\Domain\Models\Session;
use Modules\POS\Session\Domain\ValueObjects\DeviceFingerprint;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;
use Modules\POS\Shift\Domain\Models\Shift;
use Modules\POS\Shift\Domain\ValueObjects\ShiftNumber;
use Tests\TestCase;

/**
 * PKG-POS-019: Shift approval workflow endpoints.
 */
final class ShiftApprovalApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private ShiftRepositoryInterface $shiftRepo;

    private const CASHIER_ID = 'b0000000-0000-4000-b000-000000000033';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->shiftRepo = app(ShiftRepositoryInterface::class);
    }

    public function test_approve_shift_returns_200_with_closed_status(): void
    {
        $shiftId = $this->makeShiftInClosingState();

        $response = $this->actingAs($this->user)
            ->putJson('/api/pos/shifts/'.$shiftId.'/approve', [
                'expected_closing' => ['amount' => '500.00', 'currency' => self::CURRENCY],
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'closed')
            ->assertJsonPath('data.id', $shiftId);
    }

    public function test_approve_shift_validates_expected_closing_required(): void
    {
        $shiftId = $this->makeShiftInClosingState();

        $this->actingAs($this->user)
            ->putJson('/api/pos/shifts/'.$shiftId.'/approve', [])
            ->assertStatus(422);
    }

    public function test_approve_shift_returns_404_for_missing_shift(): void
    {
        $this->actingAs($this->user)
            ->putJson('/api/pos/shifts/00000000-0000-4000-0000-000000000000/approve', [
                'expected_closing' => ['amount' => '500.00', 'currency' => self::CURRENCY],
            ])
            ->assertStatus(404);
    }

    public function test_approve_shift_requires_authentication(): void
    {
        $this->putJson('/api/pos/shifts/any-id/approve', [])
            ->assertStatus(401);
    }

    public function test_reject_shift_returns_200_with_closing_status(): void
    {
        $shiftId = $this->makeShiftInClosingState();

        $response = $this->actingAs($this->user)
            ->putJson('/api/pos/shifts/'.$shiftId.'/reject', [
                'reason' => 'Count does not match expected amount.',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'closing')
            ->assertJsonPath('data.id', $shiftId);
    }

    public function test_reject_shift_validates_reason_required(): void
    {
        $shiftId = $this->makeShiftInClosingState();

        $this->actingAs($this->user)
            ->putJson('/api/pos/shifts/'.$shiftId.'/reject', [])
            ->assertStatus(422);
    }

    public function test_reject_shift_returns_404_for_missing_shift(): void
    {
        $this->actingAs($this->user)
            ->putJson('/api/pos/shifts/00000000-0000-4000-0000-000000000000/reject', [
                'reason' => 'Some reason.',
            ])
            ->assertStatus(404);
    }

    public function test_reject_shift_requires_authentication(): void
    {
        $this->putJson('/api/pos/shifts/any-id/reject', [])
            ->assertStatus(401);
    }

    public function test_approve_fails_when_shift_not_in_closing_state(): void
    {
        // Open shift — cannot be approved directly (must submit first)
        $sessionRepo = app(SessionRepositoryInterface::class);
        $session = Session::open(
            cashierId: self::CASHIER_ID,
            companyId: 'c0000000-0000-4000-c000-000000000033',
            channelId: null,
            warehouseId: 'w0000000-0000-4000-w000-000000000033',
            fingerprint: DeviceFingerprint::of('fp-approval-open'),
            ipAddress: '127.0.0.1',
            deviceType: DeviceType::Browser,
        );
        $sessionRepo->save($session);

        $shift = Shift::open(
            sessionId: (string) $session->id,
            terminalId: self::CASHIER_ID, // terminal_id = cashier_id after refactor
            cashierId: self::CASHIER_ID,
            openingCash: Money::of('500.00', self::CURRENCY),
            shiftNumber: ShiftNumber::of(1),
        );
        $this->shiftRepo->save($shift);
        $shiftId = (string) $shift->id;

        $this->actingAs($this->user)
            ->putJson('/api/pos/shifts/'.$shiftId.'/approve', [
                'expected_closing' => ['amount' => '500.00', 'currency' => self::CURRENCY],
            ])
            ->assertStatus(422);
    }

    private function makeShiftInClosingState(): string
    {
        $sessionRepo = app(SessionRepositoryInterface::class);
        $session = Session::open(
            cashierId: Str::uuid()->toString(), // unique UUID per test invocation
            companyId: 'c0000000-0000-4000-c000-000000000033',
            channelId: null,
            warehouseId: 'w0000000-0000-4000-w000-000000000033',
            fingerprint: DeviceFingerprint::of('fp-approval-test-'.uniqid()),
            ipAddress: '127.0.0.1',
            deviceType: DeviceType::Browser,
        );
        $sessionRepo->save($session);

        $shift = Shift::open(
            sessionId: (string) $session->id,
            terminalId: self::CASHIER_ID, // terminal_id = cashier_id after refactor
            cashierId: self::CASHIER_ID,
            openingCash: Money::of('500.00', self::CURRENCY),
            shiftNumber: ShiftNumber::of(1),
        );
        $shift->submitForClosure(Money::of('500.00', self::CURRENCY));
        $this->shiftRepo->save($shift);

        return (string) $shift->id;
    }
}
