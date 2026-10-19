<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class PurchaseOrderNotEditableException extends BusinessException
{
    public function __construct(string $poNumber)
    {
        parent::__construct(
            "Purchase order '{$poNumber}' cannot be modified because it is no longer in draft status.",
            [],
            422,
        );
    }
}
