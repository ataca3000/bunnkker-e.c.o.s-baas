<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class GoodsReceiptAlreadyPostedException extends BusinessException
{
    public function __construct(string $receiptNumber)
    {
        parent::__construct(
            message: "Goods receipt {$receiptNumber} has already been posted and is immutable.",
            errors: ['receipt_number' => $receiptNumber],
            statusCode: 422,
        );
    }
}
