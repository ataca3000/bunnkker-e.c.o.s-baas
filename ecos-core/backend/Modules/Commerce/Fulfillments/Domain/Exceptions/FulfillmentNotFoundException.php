<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Domain\Exceptions;

use RuntimeException;

final class FulfillmentNotFoundException extends RuntimeException
{
    public function __construct(string $id)
    {
        parent::__construct("Fulfillment [{$id}] not found.");
    }
}
