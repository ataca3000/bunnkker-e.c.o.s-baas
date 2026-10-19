<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Organization\BusinessAccounts\Application\Actions\CreateBusinessAccountAction;
use Modules\Organization\BusinessAccounts\Application\Actions\DeleteBusinessAccountAction;
use Modules\Organization\BusinessAccounts\Application\Actions\GetBusinessAccountAction;
use Modules\Organization\BusinessAccounts\Application\Actions\ListBusinessAccountsAction;
use Modules\Organization\BusinessAccounts\Application\Actions\UpdateBusinessAccountAction;
use Modules\Organization\BusinessAccounts\Application\DTO\BusinessAccountDTO;
use Modules\Organization\BusinessAccounts\Domain\Exceptions\BusinessAccountNotFoundException;
use Modules\Organization\BusinessAccounts\Presentation\Http\Requests\StoreBusinessAccountRequest;
use Modules\Organization\BusinessAccounts\Presentation\Http\Requests\UpdateBusinessAccountRequest;
use Modules\Organization\BusinessAccounts\Presentation\Http\Resources\BusinessAccountResource;

final class BusinessAccountController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListBusinessAccountsAction $action): JsonResponse
    {
        $paginator = $action->execute([
            'search' => $request->query('search'),
            'company_id' => $request->query('company_id'),
            'brand_id' => $request->query('brand_id'),
            'provider' => $request->query('provider'),
            'status' => $request->query('status'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ])->data();

        return $this->success([
            'items' => BusinessAccountResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $businessAccount, GetBusinessAccountAction $action): JsonResponse
    {
        try {
            $model = $action->execute($businessAccount)->data();

            return $this->success(new BusinessAccountResource($model));
        } catch (BusinessAccountNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }

    public function store(StoreBusinessAccountRequest $request, CreateBusinessAccountAction $action): JsonResponse
    {
        $result = $action->execute(BusinessAccountDTO::fromArray($request->validated()));

        return $this->created(new BusinessAccountResource($result->data()), $result->message());
    }

    public function update(UpdateBusinessAccountRequest $request, string $businessAccount, UpdateBusinessAccountAction $action): JsonResponse
    {
        try {
            // company_id and code are not updatable; pass a placeholder for DTO construction
            $validated = array_merge($request->validated(), [
                'company_id' => '',
                'provider' => $request->validated()['provider'],
            ]);
            $result = $action->execute($businessAccount, BusinessAccountDTO::fromArray($validated));

            return $this->updated(new BusinessAccountResource($result->data()), $result->message());
        } catch (BusinessAccountNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }

    public function destroy(string $businessAccount, DeleteBusinessAccountAction $action): JsonResponse
    {
        try {
            $result = $action->execute($businessAccount);

            return $this->deleted($result->message() ?? 'Business account deleted successfully.');
        } catch (BusinessAccountNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }
}
