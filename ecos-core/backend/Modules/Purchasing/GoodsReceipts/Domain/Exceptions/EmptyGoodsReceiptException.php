<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class EmptyGoodsReceiptException extends BusinessException
{
    public function __construct(string $receiptNumber)
    {
        parent::__construct(
            message: "Goods receipt {$receiptNumber} has no lines with a received quantity greater than zero.",
            errors: ['receipt_number' => $receiptNumber],
            statusCode: 422,
        );
    }
}
