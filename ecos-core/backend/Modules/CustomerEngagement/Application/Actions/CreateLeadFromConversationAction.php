<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Modules\CustomerEngagement\Application\Services\LeadService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\Lead;

class CreateLeadFromConversationAction
{
    public function __construct(
        private readonly LeadService $leadService,
    ) {}

    public function execute(Conversation $conv, array $data = []): Lead
    {
        return $this->leadService->createFromConversation($conv, $data);
    }
}
