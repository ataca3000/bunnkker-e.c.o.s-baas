<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\DB;
use Modules\Sales\Customers\Application\DTO\CustomerDTO;
use Modules\Sales\Customers\Domain\Contracts\CustomerRepositoryInterface;
use Modules\Sales\Customers\Domain\Models\Customer;
use Modules\Sales\Customers\Domain\Models\CustomerBrand;

final class CreateCustomerAction extends BaseAction
{
    public function __construct(private readonly CustomerRepositoryInterface $customers) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var CustomerDTO $dto */
        $dto = $arguments[0];

        /** @var Customer $customer */
        $customer = DB::transaction(function () use ($dto): Customer {
            $customer = $this->customers->create([
                'company_id'     => $dto->company_id,
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

            if ($dto->brand_id !== null) {
                CustomerBrand::create([
                    'customer_id' => $customer->id,
                    'brand_id'    => $dto->brand_id,
                    'is_primary'  => true,
                    'status'      => 'active',
                ]);
            }

            return $customer;
        });

        return OperationResult::success(
            $customer->load('customerBrands'),
            'Customer created successfully.',
        );
    }
}
