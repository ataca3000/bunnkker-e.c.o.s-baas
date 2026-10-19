<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Organization\Branches\Application\Actions\CreateBranchAction;
use Modules\Organization\Branches\Application\Actions\DeleteBranchAction;
use Modules\Organization\Branches\Application\Actions\GetBranchAction;
use Modules\Organization\Branches\Application\Actions\ListBranchesAction;
use Modules\Organization\Branches\Application\Actions\UpdateBranchAction;
use Modules\Organization\Branches\Application\DTO\BranchDTO;
use Modules\Organization\Branches\Domain\Exceptions\BranchNotFoundException;
use Modules\Organization\Branches\Domain\Exceptions\DuplicateHeadOfficeException;
use Modules\Organization\Branches\Presentation\Http\Requests\StoreBranchRequest;
use Modules\Organization\Branches\Presentation\Http\Requests\UpdateBranchRequest;
use Modules\Organization\Branches\Presentation\Http\Resources\BranchResource;

/**
 * Branches CRUD endpoints. Controllers stay thin — behavior lives in actions,
 * validation in form requests, output shaping in resources.
 */
final class BranchController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListBranchesAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'company_id' => $request->query('company_id'),
            'status' => $request->query('status', 'all'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => BranchResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $branch, GetBranchAction $action): JsonResponse
    {
        try {
            $model = $action->execute($branch)->data();
        } catch (BranchNotFoundException) {
            return $this->error('Branch not found.', 404);
        }

        return $this->success(new BranchResource($model));
    }

    public function store(StoreBranchRequest $request, CreateBranchAction $action): JsonResponse
    {
        try {
            $result = $action->execute(BranchDTO::fromArray($request->validated()));
        } catch (DuplicateHeadOfficeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->created(new BranchResource($result->data()), $result->message());
    }

    public function update(
        UpdateBranchRequest $request,
        string $branch,
        UpdateBranchAction $action,
    ): JsonResponse {
        try {
            $result = $action->execute($branch, BranchDTO::fromArray($request->validated()));
        } catch (BranchNotFoundException) {
            return $this->error('Branch not found.', 404);
        } catch (DuplicateHeadOfficeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->updated(new BranchResource($result->data()), $result->message());
    }

    public function destroy(string $branch, DeleteBranchAction $action): JsonResponse
    {
        try {
            $result = $action->execute($branch);
        } catch (BranchNotFoundException) {
            return $this->error('Branch not found.', 404);
        }

        return $this->deleted($result->message() ?? 'Branch deleted successfully.');
    }
}
