<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\ReleasePipelineService;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;
use Modules\System\Engineering\Infrastructure\Jobs\ExecutePipelineJob;
use Modules\System\Engineering\Presentation\Http\Resources\PipelineResource;

final class PipelineController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly ReleasePipelineService $service,
    ) {}

    /** GET /api/system/engineering/pipelines */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 15);
        $page    = (int) $request->query('page', 1);

        $paginator = EngineeringPipeline::orderByDesc('created_at')
            ->paginate($perPage, ['*'], 'page', $page);

        return $this->success([
            'data' => PipelineResource::collection($paginator->items()),
            'meta' => [
                'page'     => $paginator->currentPage(),
                'perPage'  => $paginator->perPage(),
                'total'    => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }

    /** POST /api/system/engineering/pipelines */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'task_name' => 'nullable|string|max:255',
            'branch'    => ['nullable', 'string', 'max:100', 'regex:/^[a-zA-Z0-9._\/\-]+$/'],
            'template'  => 'nullable|string|max:100',
        ]);

        $pipeline = $this->service->create([
            'task_name'            => $validated['task_name'] ?? 'Manual Run',
            'branch'               => $validated['branch'] ?? 'main',
            'template'             => $validated['template'] ?? null,
            'initiated_by'         => $request->user()?->name ?? 'Claude',
            'initiated_by_user_id' => $request->user()?->id,
        ]);

        // Dispatch async execution
        ExecutePipelineJob::dispatch($pipeline->id);

        return $this->success(new PipelineResource($pipeline->load('logs')), 'Pipeline created and queued.', 201);
    }

    /** GET /api/system/engineering/pipelines/{id} */
    public function show(string $id): JsonResponse
    {
        $pipeline = EngineeringPipeline::with('logs')->find($id);

        if ($pipeline === null) {
            return $this->error('Pipeline not found', 404);
        }

        return $this->success(new PipelineResource($pipeline));
    }

    /** POST /api/system/engineering/pipelines/{id}/cancel */
    public function cancel(string $id): JsonResponse
    {
        $cancelled = $this->service->cancel($id);

        if (! $cancelled) {
            return $this->error('Pipeline cannot be cancelled (not running or does not exist)', 422);
        }

        $pipeline = EngineeringPipeline::with('logs')->find($id);

        return $this->success(new PipelineResource($pipeline), 'Pipeline cancelled.');
    }

    /** POST /api/system/engineering/pipelines/{id}/retry */
    public function retry(string $id): JsonResponse
    {
        $reset = $this->service->retry($id);

        if (! $reset) {
            return $this->error('Pipeline cannot be retried (not failed or does not exist)', 422);
        }

        $pipeline = EngineeringPipeline::find($id);
        ExecutePipelineJob::dispatch($pipeline->id);

        return $this->success(new PipelineResource($pipeline->load('logs')), 'Pipeline requeued for retry.');
    }

    /** GET /api/system/engineering/pipelines/active */
    public function active(): JsonResponse
    {
        $pipeline = EngineeringPipeline::with('logs')
            ->whereIn('status', ['pending', 'running'])
            ->orderByDesc('created_at')
            ->first();

        if ($pipeline === null) {
            return $this->success(null);
        }

        return $this->success(new PipelineResource($pipeline));
    }
}
