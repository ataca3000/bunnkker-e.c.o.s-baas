<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Sales\Customers\Domain\Contracts\CustomerRepositoryInterface;
use Modules\Sales\Customers\Domain\Exceptions\CustomerNotFoundException;

final class GetCustomerAction extends BaseAction
{
    public function __construct(private readonly CustomerRepositoryInterface $customers) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $customer = $this->customers->findById($id);

        if ($customer === null) {
            throw new CustomerNotFoundException($id);
        }

        return OperationResult::success($customer);
    }
}
