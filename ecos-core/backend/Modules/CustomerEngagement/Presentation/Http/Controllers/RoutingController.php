<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Actions\AutoRouteConversationAction;
use Modules\CustomerEngagement\Application\Services\RoutingService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\RoutingRule;
use Modules\CustomerEngagement\Presentation\Http\Resources\RoutingRuleResource;

class RoutingController extends Controller
{
    public function __construct(
        private readonly RoutingService $routingService,
        private readonly AutoRouteConversationAction $autoRouteAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $rules = $this->routingService->paginate($request->only(['company_id']));

        return response()->json(RoutingRuleResource::collection($rules)->response()->getData(true));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => 'required|uuid',
            'name' => 'required|string|max:255',
            'priority' => 'integer|min:1|max:9999',
            'routing_type' => 'required|string',
            'conditions' => 'required|array',
            'assign_to_user_id' => 'nullable|integer',
            'assign_to_team_id' => 'nullable|uuid',
            'apply_sla_policy' => 'boolean',
            'sla_policy_id' => 'nullable|uuid',
            'set_priority' => 'nullable|string|in:high,medium,low',
            'is_active' => 'boolean',
        ]);
        $rule = $this->routingService->create($data);

        return response()->json(new RoutingRuleResource($rule), 201);
    }

    public function show(RoutingRule $rule): JsonResponse
    {
        return response()->json(new RoutingRuleResource($rule));
    }

    public function update(Request $request, RoutingRule $rule): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'priority' => 'integer|min:1|max:9999',
            'routing_type' => 'sometimes|string',
            'conditions' => 'sometimes|array',
            'assign_to_user_id' => 'nullable|integer',
            'assign_to_team_id' => 'nullable|uuid',
            'is_active' => 'boolean',
        ]);

        return response()->json(new RoutingRuleResource($this->routingService->update($rule, $data)));
    }

    public function destroy(RoutingRule $rule): JsonResponse
    {
        $this->routingService->delete($rule);

        return response()->json(null, 204);
    }

    public function applyToConversation(Conversation $conversation): JsonResponse
    {
        $this->autoRouteAction->execute($conversation);

        return response()->json(['ok' => true]);
    }
}
