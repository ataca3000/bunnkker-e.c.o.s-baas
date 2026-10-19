<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Actions\ApplyMacroAction;
use Modules\CustomerEngagement\Application\Actions\SendOutboundMessageAction;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\ConversationMacro;
use Modules\CustomerEngagement\Presentation\Http\Resources\MessageResource;

class OutboundMessageController extends Controller
{
    public function __construct(
        private readonly SendOutboundMessageAction $sendAction,
        private readonly ApplyMacroAction $macroAction,
    ) {}

    public function send(Request $request, Conversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'message_type' => 'required|string',
            'content' => 'nullable|string',
            'media_url' => 'nullable|url',
            'media_type' => 'nullable|string',
            'reply_to_message_id' => 'nullable|uuid',
            'template_name' => 'nullable|string',
            'template_params' => 'nullable|array',
            'language_code' => 'nullable|string|size:2',
        ]);

        $message = $this->sendAction->execute($conversation, (string) $request->user()->id, $validated);

        return response()->json(new MessageResource($message), 201);
    }

    public function applyMacro(Request $request, Conversation $conversation, ConversationMacro $macro): JsonResponse
    {
        $context = $request->input('context', []);
        $message = $this->macroAction->execute($conversation, $macro, (string) $request->user()->id, $context);

        return response()->json(new MessageResource($message), 201);
    }
}
