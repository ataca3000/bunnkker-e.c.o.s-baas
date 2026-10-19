<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Enums;

/**
 * The lifecycle of a capacity REQUEST.
 *
 * ┌─ NOT A COPY OF THE LEDGER'S STATUS ─────────────────────────────────────┐
 * │ CapacityCommitmentStatus (Network) says whether capacity is held. This   │
 * │ says what happened to the ask. They are deliberately different sets:     │
 * │ Failed has no ledger equivalent because a refused request never becomes  │
 * │ a commitment at all, and that refusal is exactly what operations needs   │
 * │ to see.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
enum ReservationStatus: string
{
    case Pending = 'pending';
    case Held = 'held';
    case Confirmed = 'confirmed';
    case Released = 'released';
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Held => 'Held',
            self::Confirmed => 'Confirmed',
            self::Released => 'Released',
            self::Failed => 'Refused',
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::Confirmed => 'success',
            self::Held => 'info',
            self::Pending => 'neutral',
            self::Released => 'neutral',
            self::Failed => 'danger',
        };
    }

    /** Whether the ledger is holding something on this request's behalf. */
    public function holdsCapacity(): bool
    {
        return $this === self::Held || $this === self::Confirmed;
    }

    public function isTerminal(): bool
    {
        return $this === self::Released || $this === self::Failed;
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Held, self::Failed],
            self::Held => [self::Confirmed, self::Released, self::Failed],
            self::Confirmed => [self::Released],
            self::Released, self::Failed => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, tone: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => ['value' => $c->value, 'label' => $c->label(), 'tone' => $c->tone()],
            self::cases(),
        );
    }
}
