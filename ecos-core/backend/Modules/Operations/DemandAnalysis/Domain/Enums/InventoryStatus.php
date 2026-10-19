<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Domain\Enums;

enum InventoryStatus: string
{
    /** All ordered units can be fulfilled from current stock. */
    case Ready = 'READY';

    /** Stock exists but is insufficient to cover total ordered quantity. */
    case Shortage = 'SHORTAGE';

    /** Product exists in inventory system but on-hand quantity is zero. */
    case OutOfStock = 'OUT_OF_STOCK';

    /** Product has no inventory record — not yet tracked in the warehouse. */
    case Unknown = 'UNKNOWN';
}
