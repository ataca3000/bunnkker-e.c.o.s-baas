<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Domain\Exceptions;

use RuntimeException;

final class FulfillmentNotFulfillableException extends RuntimeException
{
    public function __construct(string $status)
    {
        parent::__construct("Fulfillment cannot be fulfilled from status [{$status}].");
    }
}
