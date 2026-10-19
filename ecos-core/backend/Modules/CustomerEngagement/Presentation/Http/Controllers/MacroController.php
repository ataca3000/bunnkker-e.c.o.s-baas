<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Services\MacroService;
use Modules\CustomerEngagement\Domain\Models\ConversationMacro;
use Modules\CustomerEngagement\Presentation\Http\Resources\ConversationMacroResource;

class MacroController extends Controller
{
    public function __construct(private readonly MacroService $macroService) {}

    public function index(Request $request): JsonResponse
    {
        $macros = $this->macroService->paginate($request->only(['company_id', 'category', 'search']));

        return response()->json(ConversationMacroResource::collection($macros)->response()->getData(true));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'shortcut' => 'nullable|string|max:50',
            'category' => 'required|string',
            'content' => 'required|string',
            'variables' => 'nullable|array',
            'applies_to_channels' => 'nullable|array',
            'is_shared' => 'boolean',
            'company_id' => 'required|uuid',
        ]);
        $data['created_by'] = (string) $request->user()->id;
        $macro = $this->macroService->create($data);

        return response()->json(new ConversationMacroResource($macro), 201);
    }

    public function show(ConversationMacro $macro): JsonResponse
    {
        return response()->json(new ConversationMacroResource($macro));
    }

    public function update(Request $request, ConversationMacro $macro): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'shortcut' => 'nullable|string|max:50',
            'category' => 'sometimes|string',
            'content' => 'sometimes|string',
            'variables' => 'nullable|array',
            'applies_to_channels' => 'nullable|array',
            'is_shared' => 'boolean',
        ]);
        $macro = $this->macroService->update($macro, $data);

        return response()->json(new ConversationMacroResource($macro));
    }

    public function destroy(ConversationMacro $macro): JsonResponse
    {
        $this->macroService->delete($macro);

        return response()->json(null, 204);
    }
}
