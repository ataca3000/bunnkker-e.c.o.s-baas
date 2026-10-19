<?php

declare(strict_types=1);

namespace Tests\Feature\Core;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * SPRINT-AUTONOMOUS-001 Phase 4b — the notification feed.
 *
 * The `notifications` table has been written to since 2026-07 with nothing to
 * read it back, so the header bell rendered fabricated data instead. These
 * tests pin the contract that replaced it, and in particular the one boundary
 * that must never move: the feed is gated by OWNERSHIP, not a permission, so a
 * user can never see, mark or count another user's notifications.
 */
class NotificationFeedTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private User $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->other = User::factory()->create();
    }

    /** @param array<string, mixed> $data */
    private function notify(User $user, array $data = [], ?string $readAt = null): string
    {
        $id = (string) Str::uuid();

        DB::table('notifications')->insert([
            'id' => $id,
            'type' => 'Modules\\Operations\\Preparation\\Application\\Notifications\\WaveCompletedNotification',
            'notifiable_type' => $user->getMorphClass(),
            'notifiable_id' => $user->getKey(),
            'data' => json_encode($data === [] ? ['message' => 'Wave W-1 completed'] : $data),
            'read_at' => $readAt,
            'created_at' => now(),
        ]);

        return $id;
    }

    public function test_it_requires_authentication(): void
    {
        $this->getJson('/api/notifications')->assertUnauthorized();
    }

    public function test_it_returns_only_the_callers_own_notifications(): void
    {
        $mine = $this->notify($this->user);
        $theirs = $this->notify($this->other);

        $response = $this->actingAs($this->user)->getJson('/api/notifications')->assertOk();

        $ids = array_column($response->json('data.data'), 'id');

        $this->assertContains($mine, $ids);
        $this->assertNotContains($theirs, $ids, 'A user must never receive another user\'s notifications.');
    }

    public function test_the_unread_count_ignores_other_users(): void
    {
        $this->notify($this->user);
        $this->notify($this->user, [], now()->toDateTimeString());
        $this->notify($this->other);
        $this->notify($this->other);

        $response = $this->actingAs($this->user)->getJson('/api/notifications')->assertOk();

        $this->assertSame(1, $response->json('data.unread_count'));
    }

    public function test_the_unread_filter_returns_only_unread(): void
    {
        $unread = $this->notify($this->user);
        $this->notify($this->user, [], now()->toDateTimeString());

        $response = $this->actingAs($this->user)
            ->getJson('/api/notifications?unread=1')
            ->assertOk();

        $this->assertSame([$unread], array_column($response->json('data.data'), 'id'));
    }

    public function test_the_producers_payload_is_passed_through_unchanged(): void
    {
        // Producers own their payloads. A reshaping layer here would silently
        // drop whatever a producer adds next.
        $this->notify($this->user, [
            'type' => 'wave_completed',
            'message' => 'Wave W-42 completed — 8 products in Prepared Pool',
            'severity' => 'success',
            'pool_entries_created' => 8,
        ]);

        $row = $this->actingAs($this->user)->getJson('/api/notifications')->json('data.data.0');

        $this->assertSame('wave_completed', $row['data']['type']);
        $this->assertSame('success', $row['data']['severity']);
        $this->assertSame(8, $row['data']['pool_entries_created']);
        $this->assertStringContainsString('W-42', $row['data']['message']);
    }

    public function test_marking_read_sets_read_at(): void
    {
        $id = $this->notify($this->user);

        $this->actingAs($this->user)
            ->patchJson("/api/notifications/{$id}/read")
            ->assertOk();

        $this->assertNotNull(DB::table('notifications')->where('id', $id)->value('read_at'));
    }

    public function test_marking_another_users_notification_read_is_a_404_not_a_403(): void
    {
        // 404, because from this caller's perspective the record does not exist.
        // A 403 would confirm that it does.
        $id = $this->notify($this->other);

        $this->actingAs($this->user)
            ->patchJson("/api/notifications/{$id}/read")
            ->assertNotFound();

        $this->assertNull(DB::table('notifications')->where('id', $id)->value('read_at'));
    }

    public function test_mark_all_read_stops_at_the_callers_own_feed(): void
    {
        $this->notify($this->user);
        $this->notify($this->user);
        $theirs = $this->notify($this->other);

        $response = $this->actingAs($this->user)
            ->postJson('/api/notifications/mark-all-read')
            ->assertOk();

        $this->assertSame(2, $response->json('data.updated'));
        $this->assertNull(DB::table('notifications')->where('id', $theirs)->value('read_at'));
    }

    public function test_per_page_is_capped(): void
    {
        $this->notify($this->user);

        $response = $this->actingAs($this->user)
            ->getJson('/api/notifications?per_page=10000')
            ->assertOk();

        $this->assertSame(100, $response->json('data.meta.perPage'));
    }
}
