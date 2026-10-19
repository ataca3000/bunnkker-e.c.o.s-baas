<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

enum DefectStatus: string
{
    case Open = 'open';
    case Acknowledged = 'acknowledged';
    case InRepair = 'in_repair';
    case Resolved = 'resolved';
    case Reopened = 'reopened';
    case Dismissed = 'dismissed';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::Acknowledged => 'Acknowledged',
            self::InRepair => 'In Repair',
            self::Resolved => 'Resolved',
            self::Reopened => 'Reopened',
            self::Dismissed => 'Dismissed',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Open => [self::Acknowledged, self::InRepair, self::Dismissed],
            self::Acknowledged => [self::InRepair, self::Dismissed],
            self::InRepair => [self::Resolved, self::Acknowledged],
            self::Resolved => [self::Reopened],
            self::Reopened => [self::InRepair, self::Dismissed],
            self::Dismissed => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** A defect counts against fitness until it is resolved or dismissed. */
    public function isOutstanding(): bool
    {
        return ! in_array($this, [self::Resolved, self::Dismissed], true);
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
