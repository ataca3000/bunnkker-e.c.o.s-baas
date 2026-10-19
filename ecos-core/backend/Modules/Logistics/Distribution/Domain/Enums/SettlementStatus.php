<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Enums;

enum SettlementStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case Reconciled = 'reconciled';
    case Disputed = 'disputed';
    case Finalized = 'finalized';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Submitted => 'Submitted',
            self::Reconciled => 'Reconciled',
            self::Disputed => 'Disputed',
            self::Finalized => 'Finalized',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Submitted],
            self::Submitted => [self::Reconciled, self::Disputed],
            self::Reconciled => [self::Finalized, self::Disputed],
            self::Disputed => [self::Reconciled],
            self::Finalized => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isFinal(): bool
    {
        return $this === self::Finalized;
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
