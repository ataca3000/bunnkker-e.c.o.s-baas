<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Modules\CustomerEngagement\Application\Services\ConversationService;
use Modules\CustomerEngagement\Application\Services\SlaService;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class CreateConversationAction
{
    public function __construct(
        private readonly ConversationService $conversationService,
        private readonly SlaService $slaService,
    ) {}

    public function execute(array $data): Conversation
    {
        $conv = $this->conversationService->create($data);

        // Auto-start SLA tracking
        $this->slaService->startTracking($conv);

        return $conv;
    }
}
