<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Domain\Models\EngineeringNotification;
use Modules\System\Engineering\Presentation\Http\Resources\NotificationResource;

final class EngineeringNotificationController extends Controller
{
    use HasApiResponse;

    /** GET /api/system/engineering/notifications */
    public function index(Request $request): JsonResponse
    {
        $perPage  = (int) $request->query('per_page', 25);
        $page     = (int) $request->query('page', 1);
        $unread   = $request->boolean('unread');

        $query = EngineeringNotification::orderByDesc('created_at');

        if ($unread) {
            $query->where('is_read', false);
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return $this->success([
            'data'         => NotificationResource::collection($paginator->items()),
            'unread_count' => EngineeringNotification::where('is_read', false)->count(),
            'meta'         => [
                'page'     => $paginator->currentPage(),
                'perPage'  => $paginator->perPage(),
                'total'    => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }

    /** PATCH /api/system/engineering/notifications/{id}/read */
    public function markRead(string $id): JsonResponse
    {
        $notification = EngineeringNotification::find($id);

        if ($notification === null) {
            return $this->error('Notification not found', 404);
        }

        $notification->update(['is_read' => true, 'read_at' => now()]);

        return $this->success(new NotificationResource($notification));
    }

    /** POST /api/system/engineering/notifications/mark-all-read */
    public function markAllRead(): JsonResponse
    {
        $updated = EngineeringNotification::where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        return $this->success(['updated' => $updated]);
    }
}
