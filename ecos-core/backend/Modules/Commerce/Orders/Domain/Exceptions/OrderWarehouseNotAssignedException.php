<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

final class OrderWarehouseNotAssignedException extends UnprocessableEntityHttpException
{
    public function __construct(string $orderId)
    {
        parent::__construct("Order [{$orderId}] has no assigned warehouse — cannot perform inventory operations.");
    }
}
