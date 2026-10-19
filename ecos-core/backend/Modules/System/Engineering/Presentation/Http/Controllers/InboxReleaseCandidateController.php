<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\System\Engineering\Application\Services\ReleaseCandidateService;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseCandidate;
use Modules\System\Engineering\Presentation\Http\Resources\EngineeringReleaseCandidateResource;

final class InboxReleaseCandidateController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly ReleaseCandidateService $releaseCandidateService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = Auth::user()->company_id;

        $filters = array_filter([
            'status' => $request->input('status'),
        ], fn ($v) => $v !== null);

        $paginator = $this->releaseCandidateService->list(
            $companyId,
            $filters,
            $request->integer('page', 1),
            $request->integer('per_page', 25),
        );

        return $this->success([
            'data' => EngineeringReleaseCandidateResource::collection($paginator->items()),
            'meta' => [
                'page'     => $paginator->currentPage(),
                'perPage'  => $paginator->perPage(),
                'total'    => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'       => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'task_ids'    => ['sometimes', 'array'],
            'task_ids.*'  => ['integer', 'exists:engineering_tasks,id'],
        ]);

        $releaseCandidate = $this->releaseCandidateService->create(
            Auth::user()->company_id,
            $data,
        );

        return $this->success(
            new EngineeringReleaseCandidateResource($releaseCandidate->load('tasks')),
            201,
        );
    }

    public function show(EngineeringReleaseCandidate $releaseCandidate): JsonResponse
    {
        $releaseCandidate->load('tasks');

        return $this->success(new EngineeringReleaseCandidateResource($releaseCandidate));
    }

    public function transition(Request $request, EngineeringReleaseCandidate $releaseCandidate): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $releaseCandidate = $this->releaseCandidateService->transition(
            $releaseCandidate,
            $data['status'],
            $data['reason'] ?? null,
        );

        return $this->success(new EngineeringReleaseCandidateResource($releaseCandidate));
    }

    public function addTask(Request $request, EngineeringReleaseCandidate $releaseCandidate): JsonResponse
    {
        $data = $request->validate([
            'task_id' => ['required', 'integer', 'exists:engineering_tasks,id'],
        ]);

        $releaseCandidate = $this->releaseCandidateService->addTask(
            $releaseCandidate,
            (int) $data['task_id'],
        );

        return $this->success(
            new EngineeringReleaseCandidateResource($releaseCandidate->load('tasks')),
        );
    }

    public function removeTask(Request $request, EngineeringReleaseCandidate $releaseCandidate): JsonResponse
    {
        $data = $request->validate([
            'task_id' => ['required', 'integer', 'exists:engineering_tasks,id'],
        ]);

        $releaseCandidate = $this->releaseCandidateService->removeTask(
            $releaseCandidate,
            (int) $data['task_id'],
        );

        return $this->success(
            new EngineeringReleaseCandidateResource($releaseCandidate->load('tasks')),
        );
    }
}
