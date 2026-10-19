<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class GoodsReceiptNotFoundException extends BusinessException
{
    public function __construct(string $id)
    {
        parent::__construct("Goods receipt '{$id}' not found.", [], 404);
    }
}
