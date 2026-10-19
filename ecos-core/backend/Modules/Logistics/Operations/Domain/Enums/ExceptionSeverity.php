<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Enums;

/**
 * How loudly an exception should shout.
 *
 * Three levels, not five. A scale with more rungs than operators can act on
 * differently just moves the argument from "is this a problem?" to "is this a
 * four or a five?".
 */
enum ExceptionSeverity: string
{
    case Critical = 'critical';
    case Warning = 'warning';
    case Info = 'info';

    public function label(): string
    {
        return match ($this) {
            self::Critical => 'Critical',
            self::Warning => 'Warning',
            self::Info => 'Info',
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::Critical => 'danger',
            self::Warning => 'warning',
            self::Info => 'info',
        };
    }

    /** Higher sorts first in the queue. */
    public function rank(): int
    {
        return match ($this) {
            self::Critical => 3,
            self::Warning => 2,
            self::Info => 1,
        };
    }

    public function atLeast(self $floor): bool
    {
        return $this->rank() >= $floor->rank();
    }

    /** How long an unacknowledged exception may sit before it escalates. */
    public function defaultEscalationMinutes(): ?int
    {
        return match ($this) {
            self::Critical => 15,
            self::Warning => 60,
            // Info never escalates on a timer. Escalating trivia is how an
            // escalation channel becomes noise nobody reads.
            self::Info => null,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, tone: string, rank: int}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'tone' => $c->tone(),
                'rank' => $c->rank(),
            ],
            self::cases(),
        );
    }
}
