<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Enums;

/** Whether an interaction came from the customer, went to them, or is internal. */
enum ActivityDirection: string
{
    case Inbound = 'inbound';
    case Outbound = 'outbound';
    case Internal = 'internal';
}
