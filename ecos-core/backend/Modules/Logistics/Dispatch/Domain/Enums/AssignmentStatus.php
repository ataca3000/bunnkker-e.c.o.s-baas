<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

enum AssignmentStatus: string
{
    case Proposed = 'proposed';
    case Blocked = 'blocked';
    case Overridden = 'overridden';
    case Released = 'released';
    case Failed = 'failed';
    case Skipped = 'skipped';

    public function label(): string
    {
        return match ($this) {
            self::Proposed => 'Proposed',
            self::Blocked => 'Blocked',
            self::Overridden => 'Manually Overridden',
            self::Released => 'Released',
            self::Failed => 'Release Failed',
            self::Skipped => 'Skipped',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Proposed => [self::Released, self::Failed, self::Blocked, self::Overridden, self::Skipped],
            self::Blocked => [self::Overridden, self::Skipped, self::Proposed],
            self::Overridden => [self::Released, self::Failed, self::Skipped],
            // Failed is retryable — a V1 refusal is often transient (a driver
            // finished a shift, a vehicle came back). Released is not.
            self::Failed => [self::Proposed, self::Skipped],
            self::Released, self::Skipped => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** Whether the release pass should attempt this assignment. */
    public function isReleasable(): bool
    {
        return in_array($this, [self::Proposed, self::Overridden], true);
    }

    public function tone(): string
    {
        return match ($this) {
            self::Released => 'success',
            self::Blocked, self::Failed => 'danger',
            self::Overridden => 'warning',
            self::Skipped => 'neutral',
            self::Proposed => 'info',
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
