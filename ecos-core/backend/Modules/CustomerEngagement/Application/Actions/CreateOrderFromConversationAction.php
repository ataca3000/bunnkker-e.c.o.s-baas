<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Modules\CustomerEngagement\Application\Services\ConversationCommerceService;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class CreateOrderFromConversationAction
{
    public function __construct(private readonly ConversationCommerceService $commerceService) {}

    /**
     * $orderData follows the same shape as ManualOrderController expects.
     * We delegate actual order creation to the Orders module and link back.
     */
    public function execute(Conversation $conversation, array $orderData, int $userId): array
    {
        // Prefill customer data from conversation
        $orderData['customer_name'] ??= $conversation->customer_name;
        $orderData['customer_phone'] ??= $conversation->customer_phone;
        $orderData['customer_email'] ??= $conversation->customer_email;
        $orderData['brand_id'] ??= $conversation->brand_id;
        $orderData['channel_id'] ??= $conversation->channel_id;
        $orderData['source'] = 'conversation';
        $orderData['conversation_id'] = $conversation->id;

        // The actual order creation goes through the Orders module API
        // We just capture the result and link it back here
        // In a fully integrated implementation, inject OrderService here
        // For now, return the prepared payload so the caller (controller) can forward it
        return [
            'status' => 'ready',
            'order_data' => $orderData,
            'customer' => [
                'name' => $conversation->customer_name,
                'phone' => $conversation->customer_phone,
                'email' => $conversation->customer_email,
            ],
        ];
    }

    public function linkCreatedOrder(Conversation $conversation, string $orderId, string $orderCode, int $userId): void
    {
        $this->commerceService->linkEntity($conversation, 'order', $orderId, $orderCode, $userId);
    }
}
