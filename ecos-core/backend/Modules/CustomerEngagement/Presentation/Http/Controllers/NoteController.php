<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\PrivateNote;
use Modules\CustomerEngagement\Presentation\Http\Resources\PrivateNoteResource;

class NoteController extends Controller
{
    public function index(Conversation $conversation): JsonResponse
    {
        $notes = $conversation->privateNotes()->get();

        return response()->json(['data' => PrivateNoteResource::collection($notes)]);
    }

    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'content' => 'required|string',
            'author_id' => 'required|uuid',
            'author_type' => 'nullable|string',
            'mentioned_user_ids' => 'nullable|array',
        ]);

        $note = PrivateNote::create([
            'conversation_id' => $conversation->id,
            'author_id' => $data['author_id'],
            'author_type' => $data['author_type'] ?? 'user',
            'content' => $data['content'],
            'mentioned_user_ids' => $data['mentioned_user_ids'] ?? [],
        ]);

        $conversation->increment('internal_notes_count');

        return response()->json(['data' => new PrivateNoteResource($note)], 201);
    }

    public function destroy(Conversation $conversation, PrivateNote $note): JsonResponse
    {
        $note->delete();
        $conversation->decrement('internal_notes_count');

        return response()->json(null, 204);
    }
}
