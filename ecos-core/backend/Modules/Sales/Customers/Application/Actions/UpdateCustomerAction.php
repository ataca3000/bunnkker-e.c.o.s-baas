<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Sales\Customers\Application\DTO\CustomerDTO;
use Modules\Sales\Customers\Domain\Contracts\CustomerRepositoryInterface;
use Modules\Sales\Customers\Domain\Exceptions\CustomerNotFoundException;

final class UpdateCustomerAction extends BaseAction
{
    public function __construct(private readonly CustomerRepositoryInterface $customers) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        /** @var CustomerDTO $dto */
        $dto = $arguments[1];

        $customer = $this->customers->findById($id);

        if ($customer === null) {
            throw new CustomerNotFoundException($id);
        }

        $updated = $this->customers->update($customer, [
            // company_id is intentionally omitted — immutable after creation.
            // brand_id is intentionally omitted — managed through customer_brands relationship.
            'code'           => $dto->code,
            'name'           => $dto->name,
            'contact_person' => $dto->contact_person,
            'email'          => $dto->email,
            'phone'          => $dto->phone,
            'mobile'         => $dto->mobile,
            'country'        => $dto->country,
            'city'           => $dto->city,
            'address'        => $dto->address,
            'notes'          => $dto->notes,
            'is_active'      => $dto->is_active,
        ]);

        return OperationResult::success($updated, 'Customer updated successfully.');
    }
}
