<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Modules\CustomerEngagement\Application\Services\MacroService;
use Modules\CustomerEngagement\Application\Services\OutboundMessageService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\ConversationMacro;
use Modules\CustomerEngagement\Domain\Models\Message;

class ApplyMacroAction
{
    public function __construct(
        private readonly MacroService $macroService,
        private readonly OutboundMessageService $outboundService,
    ) {}

    public function execute(Conversation $conversation, ConversationMacro $macro, int $agentId, array $context = []): Message
    {
        $resolvedContent = $this->macroService->apply($macro, $context);

        return $this->outboundService->send($conversation, $agentId, [
            'message_type' => 'text',
            'content' => $resolvedContent,
        ]);
    }
}
