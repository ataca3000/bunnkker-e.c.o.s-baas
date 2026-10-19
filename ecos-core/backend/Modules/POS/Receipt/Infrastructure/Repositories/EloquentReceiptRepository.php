<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Infrastructure\Repositories;

use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Receipt\Domain\Exceptions\ReceiptNotFoundException;
use Modules\POS\Receipt\Domain\Models\Receipt;

final class EloquentReceiptRepository implements ReceiptRepositoryInterface
{
    public function save(Receipt $receipt): void
    {
        $receipt->save();
    }

    public function findById(string $id): Receipt
    {
        return Receipt::find($id) ?? throw ReceiptNotFoundException::withId($id);
    }

    public function findByNumber(string $receiptNumber): Receipt
    {
        $receipt = Receipt::where('receipt_number', $receiptNumber)->first();

        if ($receipt === null) {
            throw ReceiptNotFoundException::withNumber($receiptNumber);
        }

        return $receipt;
    }

    public function findByTransactionId(string $transactionId): array
    {
        return Receipt::where('original_transaction_id', $transactionId)
            ->orderBy('issued_at')
            ->get()
            ->all();
    }
}
