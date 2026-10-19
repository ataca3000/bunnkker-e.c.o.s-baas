<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

final class DashboardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'worker' => null,
                'counts' => ['queued' => 0, 'running' => 0, 'awaiting_review' => 0, 'approved_today' => 0],
                'active_task' => null,
                'recent_tasks' => [],
            ],
        ]);
    }
}
