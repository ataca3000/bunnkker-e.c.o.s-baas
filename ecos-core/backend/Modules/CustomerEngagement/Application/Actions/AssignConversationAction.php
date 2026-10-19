<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Modules\CustomerEngagement\Application\Services\AssignmentService;
use Modules\CustomerEngagement\Domain\Enums\AssignmentType;
use Modules\CustomerEngagement\Domain\Models\AssignmentLog;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class AssignConversationAction
{
    public function __construct(
        private readonly AssignmentService $assignmentService,
    ) {}

    public function execute(
        Conversation $conv,
        string $assigneeId,
        string $assigneeType = 'agent',
        string $assignmentType = 'manual',
        ?string $assignedBy = null,
        ?string $notes = null,
    ): AssignmentLog {
        return $this->assignmentService->assign(
            $conv,
            $assigneeId,
            $assigneeType,
            AssignmentType::from($assignmentType),
            $assignedBy,
            $notes,
        );
    }
}
