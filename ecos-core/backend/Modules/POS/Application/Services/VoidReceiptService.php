<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Commands\VoidReceiptCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Results\VoidReceiptResult;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;

final class VoidReceiptService
{
    public function __construct(
        private readonly ReceiptRepositoryInterface $receiptRepo,
        private readonly DomainEventPublisherInterface $publisher,
    ) {}

    public function execute(VoidReceiptCommand $command): VoidReceiptResult
    {
        $receipt = $this->receiptRepo->findById($command->receiptId);

        $receipt->void($command->cashierId, $command->reason);

        $this->receiptRepo->save($receipt);

        $this->publisher->publishAll($receipt->pullDomainEvents());

        return new VoidReceiptResult(
            receiptId: (string) $receipt->id,
            receiptNumber: $receipt->receipt_number,
        );
    }
}
