<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Organization\Companies\Application\Actions\CreateCompanyAction;
use Modules\Organization\Companies\Application\Actions\DeleteCompanyAction;
use Modules\Organization\Companies\Application\Actions\GetCompanyAction;
use Modules\Organization\Companies\Application\Actions\ListCompaniesAction;
use Modules\Organization\Companies\Application\Actions\UpdateCompanyAction;
use Modules\Organization\Companies\Application\DTO\CompanyDTO;
use Modules\Organization\Companies\Domain\Services\CompanyCodeGeneratorService;
use Modules\Organization\Companies\Presentation\Http\Requests\StoreCompanyRequest;
use Modules\Organization\Companies\Presentation\Http\Requests\UpdateCompanyRequest;
use Modules\Organization\Companies\Presentation\Http\Resources\CompanyResource;

/**
 * Companies CRUD endpoints. Controllers stay thin — behavior lives in actions,
 * validation in form requests, output shaping in resources.
 */
final class CompanyController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListCompaniesAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'status' => $request->query('status', 'all'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => CompanyResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $company, GetCompanyAction $action): JsonResponse
    {
        $model = $action->execute($company)->data();

        return $this->success(new CompanyResource($model));
    }

    public function store(
        StoreCompanyRequest $request,
        CreateCompanyAction $action,
        CompanyCodeGeneratorService $codeGenerator,
    ): JsonResponse {
        $data = $request->validated();

        if (empty($data['code'])) {
            $data['code'] = $codeGenerator->next();
        }

        $result = $action->execute(CompanyDTO::fromArray($data));

        return $this->created(new CompanyResource($result->data()), $result->message());
    }

    public function update(
        UpdateCompanyRequest $request,
        string $company,
        UpdateCompanyAction $action,
        CompanyCodeGeneratorService $codeGenerator,
    ): JsonResponse {
        $data = $request->validated();

        if (empty($data['code'])) {
            $data['code'] = $codeGenerator->next();
        }

        $result = $action->execute($company, CompanyDTO::fromArray($data));

        return $this->updated(new CompanyResource($result->data()), $result->message());
    }

    public function destroy(string $company, DeleteCompanyAction $action): JsonResponse
    {
        $result = $action->execute($company);

        return $this->deleted($result->message() ?? 'Company deleted successfully.');
    }
}
