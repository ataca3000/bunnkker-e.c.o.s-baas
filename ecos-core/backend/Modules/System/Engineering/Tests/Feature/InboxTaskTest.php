<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Str;
use Tests\TestCase;

final class InboxTaskTest extends TestCase
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

    public function test_can_list_tasks_returns_empty_initially(): void
    {
        $response = $this->getJson('/api/system/engineering/inbox/tasks');
        $response->assertStatus(200)
                 ->assertJsonStructure(['data' => ['data', 'meta']]);
    }

    public function test_can_create_task(): void
    {
        $response = $this->postJson('/api/system/engineering/inbox/tasks', [
            'title'       => 'Implement feature X',
            'description' => 'Build this feature.',
            'priority'    => 5,
        ]);
        $response->assertStatus(201)
                 ->assertJsonPath('data.title', 'Implement feature X')
                 ->assertJsonPath('data.status', 'draft')
                 ->assertJsonPath('data.priority', 5);
    }

    public function test_create_task_requires_title(): void
    {
        $this->postJson('/api/system/engineering/inbox/tasks', ['priority' => 5])
             ->assertStatus(422)
             ->assertJsonValidationErrors(['title']);
    }

    public function test_can_get_task_by_id(): void
    {
        $task = $this->postJson('/api/system/engineering/inbox/tasks', ['title' => 'Task A'])->json('data');
        $this->getJson('/api/system/engineering/inbox/tasks/' . $task['id'])
             ->assertStatus(200)
             ->assertJsonPath('data.id', $task['id'])
             ->assertJsonPath('data.title', 'Task A');
    }

    public function test_can_update_task_title(): void
    {
        $task = $this->postJson('/api/system/engineering/inbox/tasks', ['title' => 'Original'])->json('data');
        $this->putJson('/api/system/engineering/inbox/tasks/' . $task['id'], ['title' => 'Updated'])
             ->assertStatus(200)
             ->assertJsonPath('data.title', 'Updated');
    }

    public function test_can_transition_task_from_draft_to_queued(): void
    {
        $task = $this->postJson('/api/system/engineering/inbox/tasks', ['title' => 'Task'])->json('data');
        $this->postJson('/api/system/engineering/inbox/tasks/' . $task['id'] . '/transition', ['status' => 'queued'])
             ->assertStatus(200)
             ->assertJsonPath('data.status', 'queued');
    }

    public function test_cannot_transition_to_invalid_status(): void
    {
        $task = $this->postJson('/api/system/engineering/inbox/tasks', ['title' => 'Task'])->json('data');
        // Cannot go from draft directly to completed
        $this->postJson('/api/system/engineering/inbox/tasks/' . $task['id'] . '/transition', ['status' => 'completed'])
             ->assertStatus(422);
    }

    public function test_can_soft_delete_task(): void
    {
        $task = $this->postJson('/api/system/engineering/inbox/tasks', ['title' => 'Task'])->json('data');
        $this->deleteJson('/api/system/engineering/inbox/tasks/' . $task['id'])
             ->assertStatus(200);
        $this->getJson('/api/system/engineering/inbox/tasks/' . $task['id'])
             ->assertStatus(404);
    }

    public function test_can_add_comment_to_task(): void
    {
        $task = $this->postJson('/api/system/engineering/inbox/tasks', ['title' => 'Task'])->json('data');
        $this->postJson('/api/system/engineering/inbox/tasks/' . $task['id'] . '/comments', [
            'body' => 'This is a comment',
        ])->assertStatus(201)
          ->assertJsonPath('data.body', 'This is a comment');
    }

    public function test_can_list_comments_for_task(): void
    {
        $task = $this->postJson('/api/system/engineering/inbox/tasks', ['title' => 'Task'])->json('data');
        $this->postJson('/api/system/engineering/inbox/tasks/' . $task['id'] . '/comments', ['body' => 'Comment 1']);
        $this->postJson('/api/system/engineering/inbox/tasks/' . $task['id'] . '/comments', ['body' => 'Comment 2']);
        $this->getJson('/api/system/engineering/inbox/tasks/' . $task['id'] . '/comments')
             ->assertStatus(200)
             ->assertJsonCount(2, 'data.data');
    }

    public function test_kpis_returns_correct_structure(): void
    {
        $this->getJson('/api/system/engineering/inbox/kpis')
             ->assertStatus(200)
             ->assertJsonStructure(['data' => [
                 'open_tasks', 'running_tasks', 'completed_tasks',
                 'failed_tasks', 'overdue_tasks',
             ]]);
    }

    public function test_can_create_release_candidate(): void
    {
        $this->postJson('/api/system/engineering/inbox/release-candidates', [
            'title'    => 'RC v1.2.0',
            'task_ids' => [],
        ])->assertStatus(200)
          ->assertJsonPath('data.title', 'RC v1.2.0')
          ->assertJsonPath('data.status', 'draft');
    }

    public function test_cannot_access_other_company_tasks(): void
    {
        // Create task for this company
        $task = $this->postJson('/api/system/engineering/inbox/tasks', ['title' => 'My Task'])->json('data');

        // Switch to a different user with different company
        $otherUser = User::factory()->create(['company_id' => (string) Str::uuid()]);
        $this->actingAs($otherUser);

        // Should not find the task (company isolation)
        $this->getJson('/api/system/engineering/inbox/tasks/' . $task['id'])
             ->assertStatus(404);
    }
}
