<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

final class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => [], 'meta' => ['page' => 1, 'per_page' => 20, 'total' => 0, 'last_page' => 1]]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => []], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    public function queue(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['status' => 'queued']]);
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['status' => 'cancelled']]);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['status' => 'approved']]);
    }

    public function requestChanges(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['status' => 'changes_requested']]);
    }

    public function markMerged(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['status' => 'merged']]);
    }

    public function log(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['lines' => [], 'total_lines' => 0, 'has_more' => false]]);
    }
}
