<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

final class OverReceiptException extends BusinessException
{
    public function __construct(
        string $poNumber,
        float $orderedQty,
        float $alreadyReceived,
        float $nowReceiving,
    ) {
        $wouldTotal = $alreadyReceived + $nowReceiving;
        parent::__construct(
            message: "Over-receipt on {$poNumber}: ordered {$orderedQty}, already received {$alreadyReceived}, ".
                     "now receiving {$nowReceiving} — total would be {$wouldTotal}.",
            errors: [
                'po_number' => $poNumber,
                'ordered_qty' => $orderedQty,
                'already_received' => $alreadyReceived,
                'now_receiving' => $nowReceiving,
                'would_total' => $wouldTotal,
            ],
            statusCode: 422,
        );
    }
}
