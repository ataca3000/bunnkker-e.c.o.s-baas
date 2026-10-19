<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Purchasing\GoodsReceipts\Domain\Contracts\GoodsReceiptRepositoryInterface;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\GoodsReceiptNotFoundException;

final class GetGoodsReceiptAction extends BaseAction
{
    public function __construct(private readonly GoodsReceiptRepositoryInterface $receipts) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $receipt = $this->receipts->findById($id);

        if ($receipt === null) {
            throw new GoodsReceiptNotFoundException($id);
        }

        return OperationResult::success($receipt);
    }
}
