<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class PurchaseOrderNotApprovedException extends BusinessException
{
    public function __construct(string $poNumber)
    {
        parent::__construct(
            "Purchase order '{$poNumber}' must be in approved status before goods can be received against it.",
            [],
            422,
        );
    }
}
