<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Exceptions\ReceiptNotFoundException;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Receipt\Domain\Models\Receipt;

final class FindReceiptService
{
    public function __construct(
        private readonly ReceiptRepositoryInterface $receiptRepo,
    ) {}

    public function execute(string $receiptId): Receipt
    {
        try {
            return $this->receiptRepo->findById($receiptId);
        } catch (\Modules\POS\Receipt\Domain\Exceptions\ReceiptNotFoundException) {
            throw ReceiptNotFoundException::withId($receiptId);
        }
    }
}
