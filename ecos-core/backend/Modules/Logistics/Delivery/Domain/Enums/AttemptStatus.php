<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Enums;

/** One physical attempt against a Distribution stop. */
enum AttemptStatus: string
{
    case Created = 'created';
    case EnRoute = 'en_route';
    case Arrived = 'arrived';
    case InProgress = 'in_progress';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Aborted = 'aborted';

    public function label(): string
    {
        return match ($this) {
            self::Created => 'Created',
            self::EnRoute => 'En Route',
            self::Arrived => 'Arrived',
            self::InProgress => 'In Progress',
            self::Succeeded => 'Succeeded',
            self::Failed => 'Failed',
            self::Aborted => 'Aborted',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Created => [self::EnRoute, self::Aborted],
            self::EnRoute => [self::Arrived, self::Failed, self::Aborted],
            self::Arrived => [self::InProgress, self::Failed, self::Aborted],
            self::InProgress => [self::Succeeded, self::Failed, self::Aborted],
            self::Succeeded, self::Failed, self::Aborted => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isClosed(): bool
    {
        return in_array($this, [self::Succeeded, self::Failed, self::Aborted], true);
    }

    public function isOpen(): bool
    {
        return ! $this->isClosed();
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(static fn (self $c) => ['value' => $c->value, 'label' => $c->label()], self::cases());
    }
}
