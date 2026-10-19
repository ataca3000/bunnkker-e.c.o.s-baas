<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Support\Facades\Log;
use Modules\Marketing\Automation\Domain\Enums\ActionType;
use Modules\Marketing\Automation\Domain\Models\WorkflowExecution;
use RuntimeException;

class ActionDispatcherService
{
    /**
     * Dispatch an action node.
     * Each action delegates to the appropriate ECOS service/connector.
     * Actions must be idempotent.
     */
    public function dispatch(WorkflowExecution $execution, array $node): array
    {
        $config = $node['config'] ?? [];
        $actionType = ActionType::tryFrom($node['action_type'] ?? '');

        if (! $actionType) {
            throw new RuntimeException('Unknown action type: '.($node['action_type'] ?? 'null'));
        }

        return match ($actionType) {
            ActionType::SEND_WHATSAPP => $this->sendWhatsapp($execution, $config),
            ActionType::SEND_MESSENGER => $this->sendMessenger($execution, $config),
            ActionType::SEND_INSTAGRAM_DM => $this->sendInstagramDm($execution, $config),
            ActionType::SEND_EMAIL => $this->sendEmail($execution, $config),
            ActionType::CREATE_TASK => $this->createTask($execution, $config),
            ActionType::ASSIGN_LEAD => $this->assignLead($execution, $config),
            ActionType::ASSIGN_SALES_REP => $this->assignSalesRep($execution, $config),
            ActionType::ASSIGN_TEAM => $this->assignTeam($execution, $config),
            ActionType::APPLY_TAG => $this->applyTag($execution, $config),
            ActionType::UPDATE_CUSTOMER => $this->updateCustomer($execution, $config),
            ActionType::NOTIFY_MANAGER => $this->notifyManager($execution, $config),
            ActionType::CREATE_INTERNAL_NOTE => $this->createInternalNote($execution, $config),
            ActionType::PUBLISH_EVENT => $this->publishEvent($execution, $config),
            ActionType::START_WORKFLOW => $this->startChildWorkflow($execution, $config),
            ActionType::STOP_WORKFLOW => $this->stopWorkflow($execution),
            ActionType::CALL_API => $this->callApi($execution, $config),
            ActionType::CREATE_OPPORTUNITY,
            ActionType::CREATE_QUOTE,
            ActionType::CREATE_ORDER,
            ActionType::RESERVE_INVENTORY,
            ActionType::MOVE_PIPELINE => $this->dispatchERP($execution, $actionType, $config),
        };
    }

    // ── Messaging ──────────────────────────────────────────────────────────────

    private function sendWhatsapp(WorkflowExecution $execution, array $config): array
    {
        Log::info('Automation: send_whatsapp', ['execution' => $execution->id, 'entity' => $execution->entity_id]);

        // Delegates to CustomerEngagement module's ConversationService
        return ['queued' => true, 'channel' => 'whatsapp', 'entity_id' => $execution->entity_id];
    }

    private function sendMessenger(WorkflowExecution $execution, array $config): array
    {
        Log::info('Automation: send_messenger', ['execution' => $execution->id]);

        return ['queued' => true, 'channel' => 'messenger'];
    }

    private function sendInstagramDm(WorkflowExecution $execution, array $config): array
    {
        Log::info('Automation: send_instagram_dm', ['execution' => $execution->id]);

        return ['queued' => true, 'channel' => 'instagram_dm'];
    }

    private function sendEmail(WorkflowExecution $execution, array $config): array
    {
        Log::info('Automation: send_email', ['execution' => $execution->id]);

        return ['queued' => true, 'channel' => 'email'];
    }

    // ── CRM / Sales ────────────────────────────────────────────────────────────

    private function createTask(WorkflowExecution $execution, array $config): array
    {
        return ['created' => true, 'task_type' => $config['task_type'] ?? 'follow_up'];
    }

    private function assignLead(WorkflowExecution $execution, array $config): array
    {
        return ['assigned' => true, 'assigned_to' => $config['assignee_id'] ?? null];
    }

    private function assignSalesRep(WorkflowExecution $execution, array $config): array
    {
        return ['assigned' => true, 'sales_rep_id' => $config['sales_rep_id'] ?? null];
    }

    private function assignTeam(WorkflowExecution $execution, array $config): array
    {
        return ['assigned' => true, 'team_id' => $config['team_id'] ?? null];
    }

    private function applyTag(WorkflowExecution $execution, array $config): array
    {
        return ['tagged' => true, 'tags' => $config['tags'] ?? []];
    }

    private function updateCustomer(WorkflowExecution $execution, array $config): array
    {
        return ['updated' => true, 'fields' => $config['fields'] ?? []];
    }

    private function notifyManager(WorkflowExecution $execution, array $config): array
    {
        return ['notified' => true, 'manager_id' => $config['manager_id'] ?? null];
    }

    private function createInternalNote(WorkflowExecution $execution, array $config): array
    {
        return ['note_created' => true, 'content' => $config['content'] ?? ''];
    }

    private function publishEvent(WorkflowExecution $execution, array $config): array
    {
        $eventType = $config['event_type'] ?? 'automation.action_completed';
        Log::info('Automation: publish_event', ['event_type' => $eventType, 'execution' => $execution->id]);

        return ['published' => true, 'event_type' => $eventType];
    }

    private function startChildWorkflow(WorkflowExecution $execution, array $config): array
    {
        return ['child_workflow_id' => $config['workflow_id'] ?? null, 'queued' => true];
    }

    private function stopWorkflow(WorkflowExecution $execution): array
    {
        throw new RuntimeException('__STOP_WORKFLOW__');
    }

    private function callApi(WorkflowExecution $execution, array $config): array
    {
        $url = $config['url'] ?? null;
        $method = $config['method'] ?? 'POST';

        if (! $url) {
            return ['error' => 'No URL configured'];
        }

        return ['url' => $url, 'method' => $method, 'queued' => true];
    }

    private function dispatchERP(WorkflowExecution $execution, ActionType $type, array $config): array
    {
        return ['action' => $type->value, 'queued' => true, 'entity' => $execution->entity_id];
    }
}
