<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Enums;

enum ActionType: string
{
    // Messaging
    case SEND_WHATSAPP = 'send_whatsapp';
    case SEND_MESSENGER = 'send_messenger';
    case SEND_INSTAGRAM_DM = 'send_instagram_dm';
    case SEND_EMAIL = 'send_email';

    // CRM / Sales
    case CREATE_TASK = 'create_task';
    case ASSIGN_LEAD = 'assign_lead';
    case ASSIGN_SALES_REP = 'assign_sales_rep';
    case ASSIGN_TEAM = 'assign_team';
    case CREATE_OPPORTUNITY = 'create_opportunity';
    case CREATE_QUOTE = 'create_quote';
    case CREATE_ORDER = 'create_order';
    case RESERVE_INVENTORY = 'reserve_inventory';
    case MOVE_PIPELINE = 'move_pipeline';

    // Internal
    case NOTIFY_MANAGER = 'notify_manager';
    case CREATE_INTERNAL_NOTE = 'create_internal_note';
    case APPLY_TAG = 'apply_tag';
    case UPDATE_CUSTOMER = 'update_customer';

    // Platform
    case CALL_API = 'call_api';
    case PUBLISH_EVENT = 'publish_event';
    case START_WORKFLOW = 'start_workflow';
    case STOP_WORKFLOW = 'stop_workflow';

    public function isMessaging(): bool
    {
        return in_array($this, [
            self::SEND_WHATSAPP,
            self::SEND_MESSENGER,
            self::SEND_INSTAGRAM_DM,
            self::SEND_EMAIL,
        ], true);
    }

    public function requiresChannelConnection(): bool
    {
        return in_array($this, [
            self::SEND_WHATSAPP,
            self::SEND_MESSENGER,
            self::SEND_INSTAGRAM_DM,
        ], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::SEND_WHATSAPP => 'Send WhatsApp',
            self::SEND_MESSENGER => 'Send Messenger',
            self::SEND_INSTAGRAM_DM => 'Send Instagram DM',
            self::SEND_EMAIL => 'Send Email',
            self::CREATE_TASK => 'Create Task',
            self::ASSIGN_LEAD => 'Assign Lead',
            self::ASSIGN_SALES_REP => 'Assign Sales Rep',
            self::ASSIGN_TEAM => 'Assign Team',
            self::CREATE_OPPORTUNITY => 'Create Opportunity',
            self::CREATE_QUOTE => 'Create Quote',
            self::CREATE_ORDER => 'Create Order',
            self::RESERVE_INVENTORY => 'Reserve Inventory',
            self::MOVE_PIPELINE => 'Move Pipeline',
            self::NOTIFY_MANAGER => 'Notify Manager',
            self::CREATE_INTERNAL_NOTE => 'Create Internal Note',
            self::APPLY_TAG => 'Apply Tag',
            self::UPDATE_CUSTOMER => 'Update Customer',
            self::CALL_API => 'Call External API',
            self::PUBLISH_EVENT => 'Publish Business Event',
            self::START_WORKFLOW => 'Start Another Workflow',
            self::STOP_WORKFLOW => 'Stop This Workflow',
        };
    }
}
