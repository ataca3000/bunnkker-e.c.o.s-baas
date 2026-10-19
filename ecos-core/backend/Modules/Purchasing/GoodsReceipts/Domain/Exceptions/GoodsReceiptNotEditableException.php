<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class GoodsReceiptNotEditableException extends BusinessException
{
    public function __construct(string $receiptNumber)
    {
        parent::__construct(
            "Goods receipt '{$receiptNumber}' cannot be modified because it has already been posted.",
            [],
            422,
        );
    }
}
