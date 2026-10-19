<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class PurchaseOrderNotFoundException extends BusinessException
{
    public function __construct(string $id)
    {
        parent::__construct("Purchase order '{$id}' not found.", [], 404);
    }
}
