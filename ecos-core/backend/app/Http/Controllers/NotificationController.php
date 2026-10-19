<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * The authenticated user's own notification feed.
 *
 * ┌─ READ-ONLY OVER AN EXISTING TABLE ────────────────────────────────────────┐
 * │ Laravel's `notifications` table has been written to since 2026-07 by the  │
 * │ Preparation wave lifecycle and the provider health monitor, but nothing   │
 * │ ever read it back: there was no endpoint. This controller adds the read   │
 * │ side and the read-state transitions, and nothing else. No schema change,  │
 * │ no new notification producer, no delivery channel.                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The authorization gate is ownership, not a permission: a notification is
 * addressed to one notifiable, and every query below is scoped to the caller.
 * A permission would be the wrong instrument — it would let one user read
 * another's feed, which is the only thing that must never happen here.
 *
 * `data` is whatever the producing notification's `toDatabase()` returned. It is
 * passed through unchanged rather than reshaped, because each producer owns its
 * own payload and a translation layer here would silently drop fields the
 * producers add later.
 */
final class NotificationController extends Controller
{
    use HasApiResponse;

    private const MAX_PER_PAGE = 100;

    /** GET /api/notifications */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $perPage = min((int) $request->query('per_page', 25), self::MAX_PER_PAGE);

        $query = $user->notifications()->getQuery();

        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', (int) $request->query('page', 1));

        return $this->success([
            'data' => array_map(
                fn (DatabaseNotification $n): array => $this->payload($n),
                $paginator->items(),
            ),
            'unread_count' => $user->unreadNotifications()->count(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }

    /** PATCH /api/notifications/{id}/read */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->whereKey($id)->first();

        if ($notification === null) {
            return $this->error('Notification not found', 404);
        }

        $notification->markAsRead();

        return $this->success($this->payload($notification->refresh()));
    }

    /** POST /api/notifications/mark-all-read */
    public function markAllRead(Request $request): JsonResponse
    {
        $updated = $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return $this->success(['updated' => $updated]);
    }

    /**
     * The wire shape.
     *
     * `type` is the notification's FQCN — the class name is the only stable
     * discriminator the producers share, so it is exposed verbatim and the
     * caller decides how to group it.
     *
     * @return array<string, mixed>
     */
    private function payload(DatabaseNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'data' => $notification->data,
            'read_at' => $notification->read_at?->toIso8601String(),
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
    }
}
