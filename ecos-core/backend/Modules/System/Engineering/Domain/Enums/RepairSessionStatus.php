<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum RepairSessionStatus: string
{
    case Pending = 'pending';
    case Analyzing = 'analyzing';
    case GeneratingPrompt = 'generating_prompt';
    case AwaitingResponse = 'awaiting_response';
    case Applying = 'applying';
    case Completed = 'completed';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
    case Retrying = 'retrying';
    case Timeout = 'timeout';

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Completed, self::Failed, self::Cancelled, self::Timeout => true,
            default => false,
        };
    }

    /**
     * String values of all terminal states, for whereIn/whereNotIn queries.
     *
     * @return array<int, string>
     */
    public static function terminalValues(): array
    {
        return array_map(
            static fn (self $case): string => $case->value,
            array_filter(self::cases(), static fn (self $case): bool => $case->isTerminal()),
        );
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending          => 'Pending',
            self::Analyzing        => 'Analyzing',
            self::GeneratingPrompt => 'Generating Prompt',
            self::AwaitingResponse => 'Awaiting Response',
            self::Applying         => 'Applying',
            self::Completed        => 'Completed',
            self::Failed           => 'Failed',
            self::Cancelled        => 'Cancelled',
            self::Retrying         => 'Retrying',
            self::Timeout          => 'Timeout',
        };
    }

    public function canTransitionTo(self $next): bool
    {
        if ($this->isTerminal()) {
            return false;
        }

        return match ($this) {
            self::Pending          => in_array($next, [self::Analyzing, self::Cancelled], true),
            self::Analyzing        => in_array($next, [self::GeneratingPrompt, self::Failed, self::Cancelled], true),
            self::GeneratingPrompt => in_array($next, [self::AwaitingResponse, self::Failed, self::Cancelled], true),
            self::AwaitingResponse => in_array($next, [self::Applying, self::Retrying, self::Timeout, self::Failed, self::Cancelled], true),
            self::Applying         => in_array($next, [self::Completed, self::Failed, self::Cancelled], true),
            self::Retrying         => in_array($next, [self::Analyzing, self::Failed, self::Cancelled], true),
            default                => false,
        };
    }
}
