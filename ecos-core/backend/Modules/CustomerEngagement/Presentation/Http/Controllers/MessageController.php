<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Actions\IngestMessageAction;
use Modules\CustomerEngagement\Application\Services\MessageService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Presentation\Http\Resources\MessageResource;

class MessageController extends Controller
{
    public function __construct(
        private readonly MessageService $messageService,
        private readonly IngestMessageAction $ingestAction,
    ) {}

    public function thread(Request $request, Conversation $conversation): JsonResponse
    {
        $messages = $this->messageService->getThread(
            $conversation->id,
            (int) $request->get('per_page', 50),
        );

        $this->messageService->markAllRead($conversation);

        return response()->json([
            'data' => MessageResource::collection($messages),
            'meta' => [
                'current_page' => $messages->currentPage(),
                'last_page' => $messages->lastPage(),
                'per_page' => $messages->perPage(),
                'total' => $messages->total(),
            ],
        ]);
    }

    public function send(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'message_type' => 'nullable|string',
            'content' => 'required_without:media_url|nullable|string',
            'media_url' => 'required_without:content|nullable|url',
            'media_type' => 'nullable|string',
            'sender_id' => 'nullable|uuid',
            'sender_name' => 'nullable|string|max:150',
        ]);

        $message = $this->messageService->sendOutbound($conversation, $data);

        return response()->json(['data' => new MessageResource($message)], 201);
    }

    public function ingest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider' => 'required|string',
            'external_conversation_id' => 'required|string',
            'external_message_id' => 'nullable|string',
            'content' => 'nullable|string',
            'message_type' => 'nullable|string',
            'media_url' => 'nullable|url',
            'sender_name' => 'nullable|string|max:150',
            'sender_id' => 'nullable|string',
            'customer_phone' => 'nullable|string',
            'company_id' => 'nullable|uuid',
            'brand_id' => 'nullable|uuid',
            'sent_at' => 'nullable|date',
        ]);

        $message = $this->ingestAction->execute($data);

        return response()->json(['data' => new MessageResource($message)], 201);
    }

    public function markRead(Conversation $conversation): JsonResponse
    {
        $this->messageService->markAllRead($conversation);

        return response()->json(['success' => true]);
    }
}
