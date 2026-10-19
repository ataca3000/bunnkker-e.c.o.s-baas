<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

/**
 * An inspection is immutable once submitted. A mistake is corrected by a new
 * inspection, never by editing the old one — the same rule LOG-005 applies to
 * a validated proof of delivery.
 */
enum InspectionStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Abandoned = 'abandoned';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Submitted => 'Submitted',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Abandoned => 'Abandoned',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Submitted, self::Abandoned],
            self::Submitted => [self::Approved, self::Rejected],
            self::Approved, self::Rejected, self::Abandoned => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Approved, self::Rejected, self::Abandoned], true);
    }

    /** Beyond draft, the recorded answers may never change. */
    public function isImmutable(): bool
    {
        return $this !== self::Draft;
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
