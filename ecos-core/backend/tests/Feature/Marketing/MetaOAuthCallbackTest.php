<?php

declare(strict_types=1);

namespace Tests\Feature\Marketing;

use App\Models\User;
use Exception;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\MetaConnector\Application\Jobs\MetaIncrementalSyncJob;
use Modules\Marketing\MetaConnector\Application\Services\MetaOAuthService;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;
use ReflectionClass;
use Tests\TestCase;

/**
 * OAuth callback happy-path regression tests.
 *
 * Verifies:
 *  1. Callback endpoint returns 422 when required params are missing.
 *  2. Successful callback returns 201 and dispatches MetaIncrementalSyncJob.
 *  3. The dispatched job carries SyncType::Full (initial full discovery).
 *  4. The dispatched job targets the correct connection ID.
 *
 * Requires a working PostgreSQL connection (run via Docker: `sail test`).
 * MetaConnectorServiceProvider::boot() resolves provider credentials from DB,
 * so these tests are skipped automatically in environments without DB access.
 * MetaOAuthService is mocked — no real Meta API calls are made.
 */
class MetaOAuthCallbackTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        try {
            \Illuminate\Support\Facades\DB::connection()->getPdo();
        } catch (Exception $e) {
            $this->markTestSkipped(
                'MetaOAuthCallbackTest requires a database connection. '.
                'Run with Docker PostgreSQL (sail test). Skipped: '.$e->getMessage(),
            );
        }
    }

    public function test_callback_returns_422_when_code_missing(): void
    {
        $user = User::factory()->make(['company_id' => (string) Str::uuid()]);

        $this->actingAs($user)
            ->getJson('/api/marketing/meta/auth/callback?state=some-state')
            ->assertStatus(422);
    }

    public function test_callback_returns_422_when_state_missing(): void
    {
        $user = User::factory()->make(['company_id' => (string) Str::uuid()]);

        $this->actingAs($user)
            ->getJson('/api/marketing/meta/auth/callback?code=some-code')
            ->assertStatus(422);
    }

    public function test_successful_callback_returns_201_with_connection_id(): void
    {
        Queue::fake();

        $companyId = (string) Str::uuid();
        $user = User::factory()->make(['company_id' => $companyId]);
        $connection = $this->makeStubConnection($companyId);

        $this->mock(MetaOAuthService::class, static function ($mock) use ($connection, $user): void {
            $mock->shouldReceive('handleCallback')
                ->once()
                ->withArgs(static fn ($code, $state, $actorId) => $code === 'test-code' &&
                    $state === 'test-state' &&
                    $actorId === (string) $user->id,
                )
                ->andReturn($connection);
        });

        $this->actingAs($user)
            ->getJson('/api/marketing/meta/auth/callback?code=test-code&state=test-state')
            ->assertStatus(201)
            ->assertJsonPath('connection.id', $connection->id);
    }

    public function test_successful_callback_dispatches_meta_sync_job(): void
    {
        Queue::fake();

        $companyId = (string) Str::uuid();
        $user = User::factory()->make(['company_id' => $companyId]);
        $connection = $this->makeStubConnection($companyId);

        $this->mock(MetaOAuthService::class, static function ($mock) use ($connection): void {
            $mock->shouldReceive('handleCallback')->once()->andReturn($connection);
        });

        $this->actingAs($user)
            ->getJson('/api/marketing/meta/auth/callback?code=any-code&state=any-state');

        Queue::assertPushed(MetaIncrementalSyncJob::class);
    }

    public function test_initial_sync_job_is_dispatched_with_full_sync_type(): void
    {
        Queue::fake();

        $companyId = (string) Str::uuid();
        $user = User::factory()->make(['company_id' => $companyId]);
        $connection = $this->makeStubConnection($companyId);

        $this->mock(MetaOAuthService::class, static function ($mock) use ($connection): void {
            $mock->shouldReceive('handleCallback')->once()->andReturn($connection);
        });

        $this->actingAs($user)
            ->getJson('/api/marketing/meta/auth/callback?code=any-code&state=any-state');

        Queue::assertPushed(MetaIncrementalSyncJob::class, static function (MetaIncrementalSyncJob $job) use ($connection): bool {
            $refl = new ReflectionClass($job);

            $idProp = $refl->getProperty('connectionId');
            $idProp->setAccessible(true);

            $typeProp = $refl->getProperty('syncType');
            $typeProp->setAccessible(true);

            return $idProp->getValue($job) === $connection->id
                && $typeProp->getValue($job) === SyncType::Full;
        });
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    /**
     * Build an unsaved MarketingConnection stub for use in mock returns.
     * We use forceFill + setRawAttributes to avoid DB writes in tests that
     * only care about the controller layer.
     */
    private function makeStubConnection(string $companyId): MarketingConnection
    {
        $connection = new MarketingConnection;
        $connection->setRawAttributes([
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            'connector_type' => 'meta',
            'status' => 'connected',
            'label' => 'Test Meta Connection',
        ]);

        return $connection;
    }
}
