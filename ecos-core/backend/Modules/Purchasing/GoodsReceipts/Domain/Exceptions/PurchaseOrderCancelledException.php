<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class PurchaseOrderCancelledException extends BusinessException
{
    public function __construct(string $poNumber)
    {
        parent::__construct(
            message: "Purchase order {$poNumber} is cancelled and cannot receive further goods.",
            errors: ['po_number' => $poNumber],
            statusCode: 422,
        );
    }
}
