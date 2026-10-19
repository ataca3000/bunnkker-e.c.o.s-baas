<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Actions\CreateOrderFromConversationAction;
use Modules\CustomerEngagement\Application\Services\ConversationCommerceService;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class ConversationCommerceController extends Controller
{
    public function __construct(
        private readonly CreateOrderFromConversationAction $createOrderAction,
        private readonly ConversationCommerceService $commerceService,
    ) {}

    /**
     * Get all orders / quotes / leads linked to this conversation.
     */
    public function linkedEntities(Conversation $conversation): JsonResponse
    {
        return response()->json($this->commerceService->getLinkedEntities($conversation));
    }

    /**
     * Prepare order data pre-filled from conversation context.
     * The frontend will use this to pre-populate the Order Creation Wizard.
     */
    public function prepareOrder(Request $request, Conversation $conversation): JsonResponse
    {
        $orderData = $request->input('order_data', []);
        $prepared = $this->createOrderAction->execute($conversation, $orderData, (string) $request->user()->id);

        return response()->json($prepared);
    }

    /**
     * Called after order is created in Orders module — links it back to conversation.
     */
    public function linkOrder(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'entity_type' => 'required|string|in:order,quote,lead,invoice',
            'entity_id' => 'required|uuid',
            'entity_code' => 'required|string',
        ]);

        $this->createOrderAction->linkCreatedOrder(
            $conversation,
            $data['entity_id'],
            $data['entity_code'],
            (string) $request->user()->id,
        );

        return response()->json(['ok' => true]);
    }

    public function kpis(Request $request): JsonResponse
    {
        $companyId = $request->input('company_id');

        return response()->json($this->commerceService->getConversationKpis($companyId));
    }
}
