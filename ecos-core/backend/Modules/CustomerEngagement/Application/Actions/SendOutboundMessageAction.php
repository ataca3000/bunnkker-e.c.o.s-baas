<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Modules\CustomerEngagement\Application\Services\OutboundMessageService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\Message;

class SendOutboundMessageAction
{
    public function __construct(private readonly OutboundMessageService $outboundService) {}

    public function execute(Conversation $conversation, int $agentId, array $data): Message
    {
        return $this->outboundService->send($conversation, $agentId, $data);
    }
}
