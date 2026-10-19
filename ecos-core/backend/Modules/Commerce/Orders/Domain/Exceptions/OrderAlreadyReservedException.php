<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

final class OrderAlreadyReservedException extends UnprocessableEntityHttpException
{
    public function __construct(string $orderId)
    {
        parent::__construct("Order [{$orderId}] inventory has already been reserved.");
    }
}
