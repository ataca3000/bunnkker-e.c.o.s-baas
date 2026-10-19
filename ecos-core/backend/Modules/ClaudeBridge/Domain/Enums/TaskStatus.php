<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Enums;

enum TaskStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    case Queued = 'queued';
    case Running = 'running';
    case Done = 'done';
    case Failed = 'failed';
    case Approved = 'approved';
    case ChangesRequested = 'changes_requested';
    case Merged = 'merged';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Pending => 'Pending',
            self::Queued => 'Queued',
            self::Running => 'Running',
            self::Done => 'Awaiting Review',
            self::Failed => 'Failed',
            self::Approved => 'Approved',
            self::ChangesRequested => 'Changes Requested',
            self::Merged => 'Merged',
            self::Cancelled => 'Cancelled',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Merged, self::Cancelled], true);
    }

    public function canQueue(): bool
    {
        return in_array($this, [self::Pending, self::ChangesRequested], true);
    }

    public function canCancel(): bool
    {
        return $this !== self::Merged;
    }
}
