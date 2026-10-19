<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum TaskStatus: string
{
    case Draft     = 'draft';
    case Queued    = 'queued';
    case Assigned  = 'assigned';
    case Accepted  = 'accepted';
    case Running   = 'running';
    case Paused    = 'paused';
    case Completed = 'completed';
    case Failed    = 'failed';
    case Cancelled = 'cancelled';
    case Released  = 'released';
    case Archived  = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Draft     => 'Draft',
            self::Queued    => 'Queued',
            self::Assigned  => 'Assigned',
            self::Accepted  => 'Accepted',
            self::Running   => 'Running',
            self::Paused    => 'Paused',
            self::Completed => 'Completed',
            self::Failed    => 'Failed',
            self::Cancelled => 'Cancelled',
            self::Released  => 'Released',
            self::Archived  => 'Archived',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [
            self::Completed,
            self::Failed,
            self::Cancelled,
            self::Released,
            self::Archived,
        ]);
    }

    public function canTransitionTo(self $next): bool
    {
        $allowed = match ($this) {
            self::Draft     => [self::Queued, self::Cancelled],
            self::Queued    => [self::Assigned, self::Cancelled],
            self::Assigned  => [self::Accepted, self::Queued, self::Cancelled],
            self::Accepted  => [self::Running, self::Cancelled],
            self::Running   => [self::Paused, self::Completed, self::Failed, self::Cancelled],
            self::Paused    => [self::Running, self::Cancelled],
            self::Completed => [self::Released, self::Archived],
            self::Failed    => [self::Queued, self::Cancelled, self::Archived],
            self::Cancelled => [self::Archived],
            self::Released  => [self::Archived],
            self::Archived  => [],
        };

        return in_array($next, $allowed);
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
