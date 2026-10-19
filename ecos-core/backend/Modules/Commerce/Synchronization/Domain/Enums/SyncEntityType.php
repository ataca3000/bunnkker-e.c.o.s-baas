<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Domain\Enums;

enum SyncEntityType: string
{
    case Product = 'product';
    case Inventory = 'inventory';
    case Order = 'order';
    case Customer = 'customer';
    case Price = 'price';
}
