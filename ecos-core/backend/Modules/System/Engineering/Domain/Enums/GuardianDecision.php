<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

/**
 * Final commit-gate decision of a Guardian run (TASK-ENG-V2-003).
 *
 * A Block decision has no override path — re-running the Guardian after
 * repair is the only way to reach Allow (never-bypass invariant).
 */
enum GuardianDecision: string
{
    case Allow = 'allow';
    case Block = 'block';

    public function label(): string
    {
        return match ($this) {
            self::Allow => 'Allow',
            self::Block => 'Block',
        };
    }

    public function allowsCommit(): bool
    {
        return $this === self::Allow;
    }
}
