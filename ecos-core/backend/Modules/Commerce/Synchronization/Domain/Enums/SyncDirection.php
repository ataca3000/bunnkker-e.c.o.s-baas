<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Domain\Enums;

enum SyncDirection: string
{
    case Inbound = 'inbound';
    case Outbound = 'outbound';
}
