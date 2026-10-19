<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Actions\CaptureAttributionAction;
use Modules\CustomerEngagement\Application\Services\AttributionCaptureService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Presentation\Http\Resources\ConversationAttributionResource;

class AttributionController extends Controller
{
    public function __construct(
        private readonly AttributionCaptureService $attributionService,
        private readonly CaptureAttributionAction $captureAction,
    ) {}

    public function show(Conversation $conversation): JsonResponse
    {
        $attribution = $this->attributionService->forConversation($conversation->id);
        if (! $attribution) {
            return response()->json(null, 204);
        }

        return response()->json(new ConversationAttributionResource($attribution));
    }

    public function capture(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate(['source_provider' => 'nullable|string', 'ad_id' => 'nullable|string', 'click_id' => 'nullable|string', 'utm_source' => 'nullable|string', 'utm_medium' => 'nullable|string', 'utm_campaign' => 'nullable|string']);
        $attribution = $this->captureAction->execute($conversation, $data);

        return response()->json(new ConversationAttributionResource($attribution), 201);
    }
}
