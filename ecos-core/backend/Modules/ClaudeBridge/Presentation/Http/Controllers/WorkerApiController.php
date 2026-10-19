<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/**
 * Worker-facing endpoints. Authenticated via VerifyWorkerToken middleware.
 */
final class WorkerApiController extends Controller
{
    public function heartbeat(Request $request): JsonResponse
    {
        return response()->json(['ok' => true]);
    }

    public function nextTask(Request $request): JsonResponse
    {
        return response()->json(null, 204);
    }

    public function startTask(Request $request, string $id): JsonResponse
    {
        return response()->json(['ok' => true]);
    }

    public function logChunk(Request $request, string $id): JsonResponse
    {
        return response()->json(['ok' => true]);
    }

    public function uploadArtifact(Request $request, string $id): JsonResponse
    {
        return response()->json(['artifact_id' => null], 201);
    }

    public function completeTask(Request $request, string $id): JsonResponse
    {
        return response()->json(['ok' => true]);
    }

    public function failTask(Request $request, string $id): JsonResponse
    {
        return response()->json(['ok' => true]);
    }

    public function myRunningTask(Request $request): JsonResponse
    {
        return response()->json(['task' => null]);
    }
}
