<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Organization\Teams\Application\Actions\CreateTeamAction;
use Modules\Organization\Teams\Application\Actions\DeleteTeamAction;
use Modules\Organization\Teams\Application\Actions\GetTeamAction;
use Modules\Organization\Teams\Application\Actions\ListTeamsAction;
use Modules\Organization\Teams\Application\Actions\UpdateTeamAction;
use Modules\Organization\Teams\Application\DTO\TeamDTO;
use Modules\Organization\Teams\Domain\Exceptions\TeamNotFoundException;
use Modules\Organization\Teams\Presentation\Http\Requests\StoreTeamRequest;
use Modules\Organization\Teams\Presentation\Http\Requests\UpdateTeamRequest;
use Modules\Organization\Teams\Presentation\Http\Resources\TeamResource;

final class TeamController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListTeamsAction $action): JsonResponse
    {
        $paginator = $action->execute([
            'search' => $request->query('search'),
            'company_id' => $request->query('company_id'),
            'status' => $request->query('status', 'all'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ])->data();

        return $this->success([
            'items' => TeamResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $team, GetTeamAction $action): JsonResponse
    {
        try {
            $model = $action->execute($team)->data();

            return $this->success(new TeamResource($model));
        } catch (TeamNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }

    public function store(StoreTeamRequest $request, CreateTeamAction $action): JsonResponse
    {
        $result = $action->execute(TeamDTO::fromArray($request->validated()));

        return $this->created(new TeamResource($result->data()), $result->message());
    }

    public function update(UpdateTeamRequest $request, string $team, UpdateTeamAction $action): JsonResponse
    {
        try {
            // company_id is not updatable; inject a placeholder for DTO construction
            $validated = array_merge($request->validated(), ['company_id' => '']);
            $result = $action->execute($team, TeamDTO::fromArray($validated));

            return $this->updated(new TeamResource($result->data()), $result->message());
        } catch (TeamNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }

    public function destroy(string $team, DeleteTeamAction $action): JsonResponse
    {
        try {
            $result = $action->execute($team);

            return $this->deleted($result->message() ?? 'Team deleted successfully.');
        } catch (TeamNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }
}
