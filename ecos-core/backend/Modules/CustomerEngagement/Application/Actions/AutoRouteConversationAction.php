<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Modules\CustomerEngagement\Application\Services\RoutingService;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class AutoRouteConversationAction
{
    public function __construct(private readonly RoutingService $routingService) {}

    public function execute(Conversation $conversation): void
    {
        $this->routingService->autoRoute($conversation);
    }
}
