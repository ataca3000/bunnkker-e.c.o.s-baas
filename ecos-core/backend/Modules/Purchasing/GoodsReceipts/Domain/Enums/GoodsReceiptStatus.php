<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Enums;

enum GoodsReceiptStatus: string
{
    case Draft = 'draft';
    case Posted = 'posted';

    public function isEditable(): bool
    {
        return $this === self::Draft;
    }
}
