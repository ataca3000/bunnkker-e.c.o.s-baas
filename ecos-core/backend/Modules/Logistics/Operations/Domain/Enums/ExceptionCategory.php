<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Enums;

/**
 * Classification — what KIND of problem this is, independent of who owns it.
 *
 * Source answers "who fixes it". Category answers "what is broken". They are
 * separate axes because a capacity problem can originate in Network or in
 * Operations' own reservation handling, and an operator filtering for "capacity
 * trouble today" wants both.
 */
enum ExceptionCategory: string
{
    case Resource = 'resource';
    case Capacity = 'capacity';
    case Dispatch = 'dispatch';
    case Routing = 'routing';
    case Execution = 'execution';
    case Carrier = 'carrier';
    case Integration = 'integration';
    case Policy = 'policy';

    public function label(): string
    {
        return match ($this) {
            self::Resource => 'Resource',
            self::Capacity => 'Capacity',
            self::Dispatch => 'Dispatch',
            self::Routing => 'Routing',
            self::Execution => 'Execution',
            self::Carrier => 'Carrier',
            self::Integration => 'Integration',
            self::Policy => 'Policy',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => ['value' => $c->value, 'label' => $c->label()],
            self::cases(),
        );
    }
}
