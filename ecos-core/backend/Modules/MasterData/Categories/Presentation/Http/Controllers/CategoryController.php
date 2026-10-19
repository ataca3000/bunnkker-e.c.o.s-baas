<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\MasterData\Categories\Application\Actions\CreateCategoryAction;
use Modules\MasterData\Categories\Application\Actions\DeleteCategoryAction;
use Modules\MasterData\Categories\Application\Actions\GetCategoryAction;
use Modules\MasterData\Categories\Application\Actions\ListCategoriesAction;
use Modules\MasterData\Categories\Application\Actions\UpdateCategoryAction;
use Modules\MasterData\Categories\Application\DTO\CategoryDTO;
use Modules\MasterData\Categories\Presentation\Http\Requests\StoreCategoryRequest;
use Modules\MasterData\Categories\Presentation\Http\Requests\UpdateCategoryRequest;
use Modules\MasterData\Categories\Presentation\Http\Resources\CategoryResource;

/**
 * Categories CRUD endpoints. Controllers stay thin — behavior lives in actions,
 * validation in form requests, output shaping in resources.
 */
final class CategoryController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListCategoriesAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'scope' => $request->query('scope'),
            'parent_id' => $request->query('parent_id'),
            'level' => $request->query('level'),
            'status' => $request->query('status', 'all'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => CategoryResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $category, GetCategoryAction $action): JsonResponse
    {
        $model = $action->execute($category)->data();

        return $this->success(new CategoryResource($model));
    }

    public function store(StoreCategoryRequest $request, CreateCategoryAction $action): JsonResponse
    {
        $result = $action->execute(CategoryDTO::fromArray($request->validated()));

        return $this->created(new CategoryResource($result->data()), $result->message());
    }

    public function update(
        UpdateCategoryRequest $request,
        string $category,
        UpdateCategoryAction $action,
    ): JsonResponse {
        $result = $action->execute($category, CategoryDTO::fromArray($request->validated()));

        return $this->updated(new CategoryResource($result->data()), $result->message());
    }

    public function destroy(string $category, DeleteCategoryAction $action): JsonResponse
    {
        $result = $action->execute($category);

        return $this->deleted($result->message() ?? 'Category deleted successfully.');
    }
}
