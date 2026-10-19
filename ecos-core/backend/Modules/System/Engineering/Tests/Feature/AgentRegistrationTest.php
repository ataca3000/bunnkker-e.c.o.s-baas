<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Str;
use Tests\TestCase;

final class AgentRegistrationTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private User $user;
    private string $companyId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyId = (string) Str::uuid();
        $this->user = User::factory()->create(['company_id' => $this->companyId]);
        $this->actingAs($this->user);
    }

    private function registerAgent(array $overrides = []): array
    {
        $payload = array_merge([
            'name'                => 'Test Agent ' . Str::random(6),
            'agent_type'          => 'standard',
            'machine_fingerprint' => Str::random(32),
            'os_info'             => 'Linux 5.15.0',
            'version'             => '1.0.0',
            'platform_info'       => ['os' => 'Linux', 'cpu_cores' => 4, 'memory_gb' => 8.0],
            'capabilities'        => [
                ['capability_key' => 'php', 'capability_version' => '8.3.0', 'proficiency' => 5],
                ['capability_key' => 'git', 'capability_version' => '2.40.0', 'proficiency' => 5],
            ],
        ], $overrides);

        $response = $this->postJson('/api/system/engineering/agents/register', $payload);
        $response->assertStatus(200)
                 ->assertJsonStructure(['data' => ['agent' => ['id', 'name', 'status'], 'api_key']]);
        return $response->json('data');
    }

    public function test_can_register_new_agent(): void
    {
        $result = $this->registerAgent();
        $this->assertNotEmpty($result['agent']['id']);
        $this->assertNotEmpty($result['api_key']);
        $this->assertSame('idle', $result['agent']['status']);
    }

    public function test_agent_is_stored_in_database(): void
    {
        $result = $this->registerAgent(['name' => 'DB Test Agent']);
        $this->assertDatabaseHas('engineering_agents', [
            'id'   => $result['agent']['id'],
            'name' => 'DB Test Agent',
        ]);
    }

    public function test_can_send_heartbeat(): void
    {
        $result = $this->registerAgent();
        $agentId = $result['agent']['id'];

        $this->postJson('/api/system/engineering/agents/' . $agentId . '/heartbeat', [
            'status'         => 'idle',
            'cpu_percent'    => 15.5,
            'memory_mb_used' => 512,
            'disk_free_gb'   => 50.0,
            'load_average'   => 0.25,
        ])->assertStatus(200)
          ->assertJsonStructure(['data' => ['heartbeat', 'stale_threshold_minutes']]);
    }

    public function test_heartbeat_updates_agent_last_seen(): void
    {
        $result = $this->registerAgent();
        $agentId = $result['agent']['id'];

        $this->postJson('/api/system/engineering/agents/' . $agentId . '/heartbeat', [
            'status'         => 'busy',
            'cpu_percent'    => 80.0,
            'memory_mb_used' => 2048,
        ])->assertStatus(200);

        $this->getJson('/api/system/engineering/agents/' . $agentId)
             ->assertStatus(200)
             ->assertJsonPath('data.status', 'busy');
    }

    public function test_can_list_agents(): void
    {
        $this->registerAgent();
        $this->registerAgent(['machine_fingerprint' => Str::random(32)]);

        $this->getJson('/api/system/engineering/agents')
             ->assertStatus(200)
             ->assertJsonStructure(['data' => ['data', 'meta']]);
    }

    public function test_can_get_agent_detail(): void
    {
        $result = $this->registerAgent();
        $agentId = $result['agent']['id'];

        $this->getJson('/api/system/engineering/agents/' . $agentId)
             ->assertStatus(200)
             ->assertJsonStructure(['data' => ['id', 'name', 'status', 'platform_info', 'capabilities']]);
    }

    public function test_can_deregister_agent(): void
    {
        $result = $this->registerAgent();
        $agentId = $result['agent']['id'];

        $this->postJson('/api/system/engineering/agents/' . $agentId . '/deregister')
             ->assertStatus(200)
             ->assertJsonPath('data.deregistered', true);

        $this->assertDatabaseHas('engineering_agents', [
            'id'     => $agentId,
            'status' => 'terminated',
        ]);
    }

    public function test_dashboard_returns_metrics(): void
    {
        $this->getJson('/api/system/engineering/agents/dashboard')
             ->assertStatus(200)
             ->assertJsonStructure(['data' => [
                 'connected_agents', 'busy_agents', 'offline_agents', 'running_tasks',
             ]]);
    }

    public function test_agents_are_company_scoped(): void
    {
        // Register for this company
        $result = $this->registerAgent();

        // Switch to different company
        $otherUser = User::factory()->create(['company_id' => (string) Str::uuid()]);
        $this->actingAs($otherUser);

        // List should not include the other company's agent
        $response = $this->getJson('/api/system/engineering/agents');
        $response->assertStatus(200);
        $agents = $response->json('data.data');
        $ids = array_column($agents, 'id');
        $this->assertNotContains($result['agent']['id'], $ids);
    }
}
