<?php

declare(strict_types=1);
namespace Modules\System\Engineering\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Domain\Models\User;
use Modules\System\Engineering\Domain\Models\EngineeringExecutionQueue;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Tests\TestCase;

class ClusterQueueTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['company_id' => \Str::uuid()]);
        $this->actingAs($this->user);
    }

    public function test_can_list_queue(): void
    {
        $res = $this->getJson('/api/system/engineering/queue');
        $res->assertOk()->assertJsonStructure(['data' => ['data', 'meta']]);
    }

    public function test_can_enqueue_task(): void
    {
        $task = EngineeringTask::factory()->create([
            'company_id' => $this->user->company_id,
            'status'     => 'queued',
        ]);
        $res = $this->postJson('/api/system/engineering/queue/enqueue', [
            'task_id'           => $task->id,
            'priority'          => 600,
            'scheduling_policy' => 'priority',
        ]);
        $res->assertStatus(201)->assertJsonPath('data.entry.task_id', $task->id);
    }

    public function test_enqueue_is_idempotent(): void
    {
        $task = EngineeringTask::factory()->create(['company_id' => $this->user->company_id, 'status' => 'queued']);
        $this->postJson('/api/system/engineering/queue/enqueue', ['task_id' => $task->id]);
        $this->postJson('/api/system/engineering/queue/enqueue', ['task_id' => $task->id]);
        $this->assertDatabaseCount('engineering_execution_queue', 1);
    }

    public function test_can_get_scheduler_status(): void
    {
        $res = $this->getJson('/api/system/engineering/queue/status');
        $res->assertOk()->assertJsonStructure(['data' => ['is_paused', 'queue_length', 'available_workers', 'tasks_scheduled_last_hour']]);
    }

    public function test_can_pause_and_resume_scheduler(): void
    {
        $this->postJson('/api/system/engineering/queue/pause')->assertOk();
        $this->postJson('/api/system/engineering/queue/resume')->assertOk();
    }

    public function test_can_cancel_queue_entry(): void
    {
        $task  = EngineeringTask::factory()->create(['company_id' => $this->user->company_id, 'status' => 'queued']);
        $entry = EngineeringExecutionQueue::factory()->create([
            'company_id' => $this->user->company_id,
            'task_id'    => $task->id,
            'status'     => 'pending',
        ]);
        $this->postJson("/api/system/engineering/queue/{$entry->id}/cancel", ['reason' => 'test'])->assertOk();
        $this->assertDatabaseHas('engineering_execution_queue', ['id' => $entry->id, 'status' => 'cancelled']);
    }

    public function test_cannot_enqueue_another_companys_task(): void
    {
        $task = EngineeringTask::factory()->create(['company_id' => \Str::uuid()]);
        $this->postJson('/api/system/engineering/queue/enqueue', ['task_id' => $task->id])->assertForbidden();
    }

    public function test_drain_queue_returns_count(): void
    {
        $task = EngineeringTask::factory()->create(['company_id' => $this->user->company_id, 'status' => 'queued']);
        EngineeringExecutionQueue::factory()->count(3)->create(['company_id' => $this->user->company_id, 'task_id' => $task->id, 'status' => 'pending']);
        $res = $this->postJson('/api/system/engineering/queue/drain', ['reason' => 'test drain']);
        $res->assertOk()->assertJsonStructure(['data' => ['count']]);
    }
}
