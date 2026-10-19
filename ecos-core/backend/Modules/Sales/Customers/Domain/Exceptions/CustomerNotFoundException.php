<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class CustomerNotFoundException extends NotFoundHttpException
{
    public function __construct(string $id)
    {
        parent::__construct("Customer [{$id}] not found.");
    }
}
