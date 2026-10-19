<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

final class ArtifactController extends Controller
{
    public function download(Request $request, string $id): JsonResponse
    {
        return response()->json(['error' => ['code' => 'NOT_IMPLEMENTED', 'message' => 'Sprint 2.']], 501);
    }
}
