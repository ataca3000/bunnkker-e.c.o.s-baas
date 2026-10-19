<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Actions\CloseConversationAction;
use Modules\CustomerEngagement\Application\Actions\CreateConversationAction;
use Modules\CustomerEngagement\Application\Services\ConversationService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Presentation\Http\Resources\ConversationResource;

class ConversationController extends Controller
{
    public function __construct(
        private readonly ConversationService $service,
        private readonly CreateConversationAction $createAction,
        private readonly CloseConversationAction $closeAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $conversations = $this->service->search(
            $request->only(['company_id', 'status', 'provider', 'priority',
                'assigned_employee_id', 'assigned_team_id', 'unread_only', 'search']),
            (int) $request->get('per_page', 25),
        );

        return response()->json([
            'data' => ConversationResource::collection($conversations),
            'meta' => [
                'current_page' => $conversations->currentPage(),
                'last_page' => $conversations->lastPage(),
                'per_page' => $conversations->perPage(),
                'total' => $conversations->total(),
            ],
        ]);
    }

    public function show(Conversation $conversation): JsonResponse
    {
        $conversation->load(['messages', 'slaViolations', 'lead']);

        return response()->json(['data' => new ConversationResource($conversation)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider' => 'required|string',
            'external_conversation_id' => 'nullable|string',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'customer_email' => 'nullable|email',
            'company_id' => 'nullable|uuid',
            'brand_id' => 'nullable|uuid',
            'channel_id' => 'nullable|uuid',
            'priority' => 'nullable|string',
            'source' => 'nullable|string|max:100',
            'language' => 'nullable|string|max:10',
            'tags' => 'nullable|array',
            'business_dna_id' => 'nullable|uuid',
            'campaign_id' => 'nullable|uuid',
            'initiative_id' => 'nullable|uuid',
        ]);

        $conv = $this->createAction->execute($data);

        return response()->json(['data' => new ConversationResource($conv)], 201);
    }

    public function update(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'status' => 'nullable|string',
            'priority' => 'nullable|string',
            'language' => 'nullable|string|max:10',
            'source' => 'nullable|string|max:100',
            'tags' => 'nullable|array',
        ]);

        $conversation->update($data);

        return response()->json(['data' => new ConversationResource($conversation->fresh())]);
    }

    public function close(Conversation $conversation): JsonResponse
    {
        $updated = $this->closeAction->execute($conversation, resolved: false);

        return response()->json(['data' => new ConversationResource($updated)]);
    }

    public function resolve(Conversation $conversation): JsonResponse
    {
        $updated = $this->closeAction->execute($conversation, resolved: true);

        return response()->json(['data' => new ConversationResource($updated)]);
    }

    public function reopen(Conversation $conversation): JsonResponse
    {
        $updated = $this->service->reopen($conversation);

        return response()->json(['data' => new ConversationResource($updated)]);
    }
}
