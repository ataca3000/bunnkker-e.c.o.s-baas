<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class InvalidPurchaseOrderStatusException extends BusinessException
{
    /** @param list<string> $allowed */
    public function __construct(string $poNumber, string $current, array $allowed = [])
    {
        $allowedStr = implode(', ', $allowed);
        parent::__construct(
            message: "Purchase order {$poNumber} has status '{$current}'".
                     ($allowedStr !== '' ? "; allowed statuses: {$allowedStr}" : ''),
            errors: ['po_number' => $poNumber, 'current_status' => $current, 'allowed' => $allowed],
            statusCode: 422,
        );
    }
}
