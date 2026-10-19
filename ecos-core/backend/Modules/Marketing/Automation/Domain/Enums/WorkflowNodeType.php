<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Enums;

enum WorkflowNodeType: string
{
    case TRIGGER = 'trigger';
    case CONDITION = 'condition';
    case ACTION = 'action';
    case WAIT = 'wait';
    case DELAY = 'delay';
    case BRANCH = 'branch';
    case LOOP = 'loop';

    public function isControlFlow(): bool
    {
        return in_array($this, [self::BRANCH, self::LOOP], true);
    }

    public function requiresActionType(): bool
    {
        return $this === self::ACTION;
    }

    public function requiresConditionType(): bool
    {
        return $this === self::CONDITION;
    }
}
