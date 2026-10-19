<?php

declare(strict_types=1);

namespace Modules\POS\Application\Contracts;

use App\Core\Responses\OperationResult;
use Modules\Commerce\Orders\Application\DTO\OrderDTO;

/**
 * Port: the POS application layer's contract for creating an ERP order.
 *
 * Decouples the POS listener from the concrete CreateOrderAction,
 * enabling independent testing and future swap (e.g. queued adapter).
 */
interface OrderCreationPortInterface
{
    public function create(OrderDTO $dto): OperationResult;
}
