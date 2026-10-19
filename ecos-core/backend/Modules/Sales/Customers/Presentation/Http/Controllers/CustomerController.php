<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Presentation\Http\Controllers;

use App\Core\Company\CurrentCompanyService;
use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Sales\Customers\Application\Actions\CreateCustomerAction;
use Modules\Sales\Customers\Application\Actions\DeleteCustomerAction;
use Modules\Sales\Customers\Application\Actions\GetCustomerAction;
use Modules\Sales\Customers\Application\Actions\ListCustomersAction;
use Modules\Sales\Customers\Application\Actions\SearchCustomerByPhoneAction;
use Modules\Sales\Customers\Application\Actions\UpdateCustomerAction;
use Modules\Sales\Customers\Application\DTO\CustomerDTO;
use Modules\Sales\Customers\Domain\Models\Customer;
use Modules\Sales\Customers\Presentation\Http\Requests\StoreCustomerRequest;
use Modules\Sales\Customers\Presentation\Http\Requests\UpdateCustomerRequest;
use Modules\Sales\Customers\Presentation\Http\Resources\CustomerResource;

final class CustomerController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly CurrentCompanyService $currentCompany) {}

    public function index(Request $request, ListCustomersAction $action): JsonResponse
    {
        $filters = [
            'search'     => $request->query('search'),
            'status'     => $request->query('status', 'all'),
            'country'    => $request->query('country'),
            'city'       => $request->query('city'),
            'brand_id'   => $request->query('brand_id'),
            'sort_by'    => $request->query('sort_by', 'created_at'),
            'sort_dir'   => $request->query('sort_dir', 'desc'),
            'per_page'   => $request->query('per_page', 10),
            'company_id' => $this->currentCompany->id(),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => CustomerResource::collection($paginator->items()),
            'meta'  => [
                'current_page' => $paginator->currentPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
                'last_page'    => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $customer, GetCustomerAction $action): JsonResponse
    {
        $model = $action->execute($customer)->data();

        return $this->success(new CustomerResource($model));
    }

    public function store(StoreCustomerRequest $request, CreateCustomerAction $action): JsonResponse
    {
        $companyId = $this->currentCompany->id();

        if ($companyId === null) {
            return $this->error('A company context is required to create a customer.', 422);
        }

        $validated = $request->validated();

        $duplicateResponse = $this->checkDuplicatePhone(
            companyId: $companyId,
            phone: $validated['phone'] ?? null,
            excludeId: null,
        );
        if ($duplicateResponse !== null) {
            return $duplicateResponse;
        }

        $payload = array_merge($validated, ['company_id' => $companyId]);
        $result  = $action->execute(CustomerDTO::fromArray($payload));

        return $this->created(new CustomerResource($result->data()), $result->message());
    }

    public function update(
        UpdateCustomerRequest $request,
        string $customer,
        UpdateCustomerAction $action,
    ): JsonResponse {
        $companyId = $this->currentCompany->id();
        $validated = $request->validated();

        if ($companyId !== null) {
            $duplicateResponse = $this->checkDuplicatePhone(
                companyId: $companyId,
                phone: $validated['phone'] ?? null,
                excludeId: $customer,
            );
            if ($duplicateResponse !== null) {
                return $duplicateResponse;
            }
        }

        $result = $action->execute($customer, CustomerDTO::fromArray($validated));

        return $this->updated(new CustomerResource($result->data()), $result->message());
    }

    public function destroy(string $customer, DeleteCustomerAction $action): JsonResponse
    {
        $result = $action->execute($customer);

        return $this->deleted($result->message() ?? 'Customer deleted successfully.');
    }

    public function searchByPhone(Request $request, SearchCustomerByPhoneAction $action): JsonResponse
    {
        $phone = trim((string) $request->query('phone', ''));

        if ($phone === '') {
            return $this->success(null, 'Phone number is required.');
        }

        $result = $action->execute($phone);

        return $this->success($result->data(), $result->message());
    }

    /**
     * Return a 422 response if a customer in the same company already owns this phone number.
     * Pass $excludeId on update so the current record is not flagged against itself.
     */
    private function checkDuplicatePhone(string $companyId, ?string $phone, ?string $excludeId): ?JsonResponse
    {
        if ($phone === null || $phone === '') {
            return null;
        }

        $query = Customer::query()
            ->where('company_id', $companyId)
            ->where('phone', $phone)
            ->whereNull('deleted_at')
            ->select(['id', 'name', 'code']);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        $existing = $query->first();

        if ($existing === null) {
            return null;
        }

        return $this->error(
            'A customer with this phone number already exists.',
            422,
            [
                'phone'             => ['duplicate_customer_phone'],
                'existing_customer' => [
                    'id'   => $existing->id,
                    'name' => $existing->name,
                    'code' => $existing->code,
                ],
            ],
        );
    }
}
