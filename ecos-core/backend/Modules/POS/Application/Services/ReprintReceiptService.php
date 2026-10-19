<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Commands\ReprintReceiptCommand;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Results\ReprintReceiptResult;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Receipt\Domain\Enums\ReprintReason;
use Modules\POS\Receipt\Domain\Policies\ReprintPolicy;

final class ReprintReceiptService
{
    public function __construct(
        private readonly ReceiptRepositoryInterface $receiptRepo,
        private readonly ReprintPolicy $reprintPolicy,
        private readonly DomainEventPublisherInterface $publisher,
    ) {}

    public function execute(ReprintReceiptCommand $command): ReprintReceiptResult
    {
        $receipt = $this->receiptRepo->findById($command->receiptId);

        $maxReprints = $this->reprintPolicy->maxReprints();

        $receipt->reprint(
            cashierId: $command->cashierId,
            terminalId: $command->terminalId,
            reason: ReprintReason::tryFrom($command->reason) ?? ReprintReason::Other,
            maxReprints: $maxReprints,
        );

        $this->receiptRepo->save($receipt);

        $this->publisher->publishAll($receipt->pullDomainEvents());

        return new ReprintReceiptResult(
            receiptId: (string) $receipt->id,
            receiptNumber: $receipt->receipt_number,
            reprintCount: $receipt->reprint_count,
        );
    }
}
