<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Enums;

enum ReviewStatus: string
{
    case Pending   = 'pending';
    case Running   = 'running';
    case Completed = 'completed';
    case Failed    = 'failed';
    case Cancelled = 'cancelled';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Failed, self::Cancelled]);
    }

    public function label(): string
    {
        return match($this) {
            self::Pending   => 'Pending',
            self::Running   => 'Running',
            self::Completed => 'Completed',
            self::Failed    => 'Failed',
            self::Cancelled => 'Cancelled',
        };
    }
}
