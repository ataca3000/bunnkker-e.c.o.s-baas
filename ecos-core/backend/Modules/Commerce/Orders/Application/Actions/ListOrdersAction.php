<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface;

final class ListOrdersAction extends BaseAction
{
    public function __construct(private readonly OrderRepositoryInterface $orders) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->orders->paginate($filters));
    }
}
