<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

/**
 * A failed validation does NOT auto-reject. Most anomalies are real purchases
 * with an unusual pattern, and auto-rejecting them teaches operators to ignore
 * the flag. An anomalous transaction becomes `validated` with a raised flag.
 */
enum FuelTransactionStatus: string
{
    case Captured = 'captured';
    case Validated = 'validated';
    case Reconciled = 'reconciled';
    case Disputed = 'disputed';
    case WrittenOff = 'written_off';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Captured => 'Captured',
            self::Validated => 'Validated',
            self::Reconciled => 'Reconciled',
            self::Disputed => 'Disputed',
            self::WrittenOff => 'Written Off',
            self::Rejected => 'Rejected',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Captured => [self::Validated, self::Rejected],
            self::Validated => [self::Reconciled, self::Disputed],
            self::Disputed => [self::Reconciled, self::WrittenOff],
            self::Reconciled, self::WrittenOff, self::Rejected => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Reconciled, self::WrittenOff, self::Rejected], true);
    }

    /** Terminal states that post a cost entry. A rejection posts nothing. */
    public function postsCost(): bool
    {
        return in_array($this, [self::Reconciled, self::WrittenOff], true);
    }

    public function requiresReason(): bool
    {
        return in_array($this, [self::Rejected, self::WrittenOff, self::Disputed], true);
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
