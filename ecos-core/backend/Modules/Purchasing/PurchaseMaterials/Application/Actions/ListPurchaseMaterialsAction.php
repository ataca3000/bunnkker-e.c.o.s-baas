<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use App\Core\Responses\OperationResult;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;

final class ListPurchaseMaterialsAction
{
    public function __construct(
        private readonly PurchaseMaterialRepositoryInterface $repository,
    ) {}

    /** @param array<string, mixed> $filters */
    public function execute(array $filters): OperationResult
    {
        return OperationResult::success($this->repository->paginate($filters), '');
    }
}
