<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Sales\Customers\Domain\Contracts\CustomerRepositoryInterface;

final class ListCustomersAction extends BaseAction
{
    public function __construct(private readonly CustomerRepositoryInterface $customers) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->customers->paginate($filters));
    }
}
