<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Contracts;

use Modules\POS\Receipt\Domain\Models\Receipt;

interface ReceiptRepositoryInterface
{
    public function save(Receipt $receipt): void;

    /** @throws \Modules\POS\Receipt\Domain\Exceptions\ReceiptNotFoundException */
    public function findById(string $id): Receipt;

    /** @throws \Modules\POS\Receipt\Domain\Exceptions\ReceiptNotFoundException */
    public function findByNumber(string $receiptNumber): Receipt;

    /** @return Receipt[] */
    public function findByTransactionId(string $transactionId): array;
}
