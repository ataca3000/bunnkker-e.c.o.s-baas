<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum MessageDeliveryStatus: string
{
    case PENDING = 'pending';
    case SENT = 'sent';
    case DELIVERED = 'delivered';
    case READ = 'read';
    case FAILED = 'failed';

    public function isTerminal(): bool
    {
        return in_array($this, [self::READ, self::FAILED]);
    }
}
