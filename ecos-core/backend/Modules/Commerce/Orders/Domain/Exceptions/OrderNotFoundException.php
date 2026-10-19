<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class OrderNotFoundException extends NotFoundHttpException
{
    public function __construct(string $id)
    {
        parent::__construct("Order [{$id}] not found.");
    }
}
