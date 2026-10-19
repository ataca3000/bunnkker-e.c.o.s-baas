<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Actions\CreateLeadFromConversationAction;
use Modules\CustomerEngagement\Application\Services\LeadService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\Lead;
use Modules\CustomerEngagement\Presentation\Http\Resources\LeadResource;

class LeadController extends Controller
{
    public function __construct(
        private readonly LeadService $leadService,
        private readonly CreateLeadFromConversationAction $createAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $leads = $this->leadService->search(
            $request->only(['company_id', 'status', 'assigned_to', 'search']),
            (int) $request->get('per_page', 25),
        );

        return response()->json([
            'data' => LeadResource::collection($leads),
            'meta' => [
                'current_page' => $leads->currentPage(),
                'last_page' => $leads->lastPage(),
                'per_page' => $leads->perPage(),
                'total' => $leads->total(),
            ],
        ]);
    }

    public function show(Lead $lead): JsonResponse
    {
        return response()->json(['data' => new LeadResource($lead)]);
    }

    public function createFromConversation(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'customer_email' => 'nullable|email',
            'priority' => 'nullable|string',
            'assigned_to' => 'nullable|uuid',
            'source' => 'nullable|string|max:100',
            'tags' => 'nullable|array',
        ]);

        $lead = $this->createAction->execute($conversation, $data);

        return response()->json(['data' => new LeadResource($lead)], 201);
    }

    public function qualify(Request $request, Lead $lead): JsonResponse
    {
        $notes = $request->input('notes');
        $lead = $this->leadService->qualify($lead, $notes);

        return response()->json(['data' => new LeadResource($lead)]);
    }

    public function disqualify(Request $request, Lead $lead): JsonResponse
    {
        $request->validate(['reason' => 'required|string|max:500']);
        $lead = $this->leadService->disqualify($lead, $request->input('reason'));

        return response()->json(['data' => new LeadResource($lead)]);
    }

    public function convert(Request $request, Lead $lead): JsonResponse
    {
        $request->validate([
            'entity_type' => 'required|string',
            'entity_id' => 'required|uuid',
        ]);

        $lead = $this->leadService->convert($lead, $request->entity_type, $request->entity_id);

        return response()->json(['data' => new LeadResource($lead)]);
    }

    public function update(Request $request, Lead $lead): JsonResponse
    {
        $data = $request->validate([
            'priority' => 'nullable|string',
            'assigned_to' => 'nullable|uuid',
            'score' => 'nullable|integer|min:0|max:100',
            'tags' => 'nullable|array',
        ]);

        $lead->update($data);

        return response()->json(['data' => new LeadResource($lead->fresh())]);
    }
}
