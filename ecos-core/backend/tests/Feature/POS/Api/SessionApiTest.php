<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Domain\Enums\DeviceType;
use Modules\POS\Session\Domain\Models\Session;
use Modules\POS\Session\Domain\ValueObjects\DeviceFingerprint;
use Tests\TestCase;

/**
 * PKG-POS-018: Session API endpoints.
 */
final class SessionApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private const CASHIER_ID = 'b0000000-0000-4000-b000-000000000001';

    private const COMPANY_ID = 'c0000000-0000-4000-c000-000000000001';

    private const WAREHOUSE_ID = 'd0000000-0000-4000-d000-000000000001';

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_open_session_returns_201_with_session_data(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/sessions', [
                'company_id' => self::COMPANY_ID,
                'warehouse_id' => self::WAREHOUSE_ID,
                'device_fingerprint' => 'fp-test-001',
                'device_type' => 'browser',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.company_id', self::COMPANY_ID)
            ->assertJsonPath('data.warehouse_id', self::WAREHOUSE_ID)
            ->assertJsonPath('data.status', 'open');
    }

    public function test_open_session_validates_required_fields(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/sessions', []);

        $response->assertStatus(422);
    }

    public function test_get_session_returns_session_data(): void
    {
        $repo = app(SessionRepositoryInterface::class);
        $session = Session::open(
            cashierId: self::CASHIER_ID,
            companyId: self::COMPANY_ID,
            channelId: null,
            warehouseId: self::WAREHOUSE_ID,
            fingerprint: DeviceFingerprint::of('fp-001'),
            ipAddress: '192.168.1.1',
            deviceType: DeviceType::Browser,
        );
        $repo->save($session);

        $response = $this->actingAs($this->user)
            ->getJson('/api/pos/sessions/'.$session->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', (string) $session->id)
            ->assertJsonPath('data.cashier_id', self::CASHIER_ID)
            ->assertJsonPath('data.company_id', self::COMPANY_ID)
            ->assertJsonPath('data.warehouse_id', self::WAREHOUSE_ID);
    }

    public function test_get_session_returns_404_when_not_found(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/pos/sessions/00000000-0000-4000-0000-000000000000');

        $response->assertStatus(404);
    }

    public function test_close_session_returns_deleted_response(): void
    {
        $repo = app(SessionRepositoryInterface::class);
        $session = Session::open(
            cashierId: self::CASHIER_ID,
            companyId: self::COMPANY_ID,
            channelId: null,
            warehouseId: self::WAREHOUSE_ID,
            fingerprint: DeviceFingerprint::of('fp-close'),
            ipAddress: '10.0.0.1',
            deviceType: DeviceType::Browser,
        );
        $repo->save($session);

        $response = $this->actingAs($this->user)
            ->deleteJson('/api/pos/sessions/'.$session->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_unauthenticated_requests_return_401(): void
    {
        $this->postJson('/api/pos/sessions', ['company_id' => self::COMPANY_ID])
            ->assertStatus(401);
    }
}
