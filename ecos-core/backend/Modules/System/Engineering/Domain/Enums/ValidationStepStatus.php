<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

/**
 * Status of a single validator step within a patch validation run (TASK-ENG-V2-002).
 */
enum ValidationStepStatus: string
{
    case Pending = 'pending';
    case Running = 'running';
    case Passed = 'passed';
    case Failed = 'failed';

    /**
     * IMPORTANT: a step may only be Skipped when it is structurally not
     * applicable to the patch file set (ValidatorType::appliesTo() === false).
     * Skipped must NEVER be used as a bypass of a failed validator.
     */
    case Skipped = 'skipped';

    case Error = 'error';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Running => 'Running',
            self::Passed  => 'Passed',
            self::Failed  => 'Failed',
            self::Skipped => 'Skipped',
            self::Error   => 'Error',
        };
    }

    public function isFailure(): bool
    {
        return match ($this) {
            self::Failed, self::Error => true,
            default => false,
        };
    }

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Passed, self::Failed, self::Skipped, self::Error => true,
            self::Pending, self::Running => false,
        };
    }
}
