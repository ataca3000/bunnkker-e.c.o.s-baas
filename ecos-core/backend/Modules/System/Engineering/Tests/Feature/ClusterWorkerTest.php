<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;
use Tests\TestCase;

class ClusterWorkerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    public function test_can_list_workers(): void
    {
        EngineeringWorker::factory()->count(3)->create(['company_id' => $this->user->company_id]);
        $res = $this->getJson('/api/system/engineering/workers');
        $res->assertOk()->assertJsonStructure(['data' => ['data'], 'success']);
    }

    public function test_can_create_worker(): void
    {
        $res = $this->postJson('/api/system/engineering/workers', [
            'name'        => 'Test Worker 01',
            'worker_type' => 'general',
        ]);
        $res->assertStatus(201)->assertJsonPath('data.worker.name', 'Test Worker 01');
    }

    public function test_cannot_create_worker_without_name(): void
    {
        $res = $this->postJson('/api/system/engineering/workers', ['worker_type' => 'general']);
        $res->assertStatus(422);
    }

    public function test_can_start_worker(): void
    {
        $worker = EngineeringWorker::factory()->create([
            'company_id'  => $this->user->company_id,
            'status'      => 'offline',
        ]);
        $res = $this->postJson("/api/system/engineering/workers/{$worker->id}/start");
        $res->assertOk()->assertJsonPath('data.worker.status', 'idle');
    }

    public function test_can_stop_worker(): void
    {
        $worker = EngineeringWorker::factory()->create([
            'company_id' => $this->user->company_id,
            'status'     => 'idle',
        ]);
        $res = $this->postJson("/api/system/engineering/workers/{$worker->id}/stop");
        $res->assertOk();
    }

    public function test_cannot_access_another_companys_worker(): void
    {
        $other = EngineeringWorker::factory()->create(['company_id' => \Str::uuid()]);
        $this->getJson("/api/system/engineering/workers/{$other->id}")->assertForbidden();
    }

    public function test_heartbeat_updates_timestamp(): void
    {
        $worker = EngineeringWorker::factory()->create(['company_id' => $this->user->company_id]);
        $before = now()->subSecond();
        $this->postJson("/api/system/engineering/workers/{$worker->id}/heartbeat", [])->assertOk();
        $this->assertDatabaseHas('engineering_workers', [
            'id' => $worker->id,
        ]);
        $fresh = $worker->fresh();
        $this->assertTrue($fresh->last_heartbeat_at >= $before);
    }

    public function test_cluster_dashboard_returns_structure(): void
    {
        $res = $this->getJson('/api/system/engineering/cluster/dashboard');
        $res->assertOk()->assertJsonStructure(['data' => ['workers', 'queue', 'resources', 'locks', 'recent_events', 'throughput']]);
    }

    public function test_health_report_returns_status(): void
    {
        $res = $this->getJson('/api/system/engineering/cluster/health');
        $res->assertOk()->assertJsonStructure(['data' => ['status', 'workers', 'resources', 'alerts', 'queue', 'checked_at']]);
    }

    public function test_metrics_snapshot_returns_data(): void
    {
        $res = $this->getJson('/api/system/engineering/cluster/metrics/snapshot');
        $res->assertOk()->assertJsonStructure(['data' => ['snapshot']]);
    }
}
