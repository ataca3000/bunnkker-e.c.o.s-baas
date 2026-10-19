<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

/** A proposal is immutable once decided. Re-running creates a new one. */
enum ProposalStatus: string
{
    case Generated = 'generated';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Superseded = 'superseded';

    public function label(): string
    {
        return match ($this) {
            self::Generated => 'Generated',
            self::Accepted => 'Accepted',
            self::Rejected => 'Rejected',
            self::Superseded => 'Superseded',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Generated => [self::Accepted, self::Rejected, self::Superseded],
            self::Accepted, self::Rejected, self::Superseded => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isDecided(): bool
    {
        return $this !== self::Generated;
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
