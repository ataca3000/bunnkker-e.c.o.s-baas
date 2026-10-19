<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Modules\CustomerEngagement\Application\Services\ConversationService;
use Modules\CustomerEngagement\Application\Services\SlaService;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class CloseConversationAction
{
    public function __construct(
        private readonly ConversationService $conversationService,
        private readonly SlaService $slaService,
    ) {}

    public function execute(Conversation $conv, bool $resolved = false): Conversation
    {
        $updated = $resolved
            ? $this->conversationService->resolve($conv)
            : $this->conversationService->close($conv);

        $this->slaService->recordResolution($updated);

        return $updated;
    }
}
