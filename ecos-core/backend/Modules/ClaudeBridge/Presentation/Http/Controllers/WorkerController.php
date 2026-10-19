<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

final class WorkerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => ['worker_id' => null, 'api_token' => null]], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return response()->json(null, 204);
    }

    public function regenerateToken(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['api_token' => null]]);
    }
}
