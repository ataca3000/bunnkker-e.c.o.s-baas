<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

final class InvalidPurchaseMaterialStatusException extends UnprocessableEntityHttpException
{
    /** @param list<string> $allowed */
    public function __construct(string $requestNumber, string $currentStatus, array $allowed)
    {
        $allowedList = implode(', ', $allowed);
        parent::__construct(
            "Purchase material [{$requestNumber}] cannot transition from [{$currentStatus}]. Allowed from: [{$allowedList}].",
        );
    }
}
