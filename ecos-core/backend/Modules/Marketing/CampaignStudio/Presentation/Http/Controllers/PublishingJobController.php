<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Actions\PublishCampaignAction;
use Modules\Marketing\CampaignStudio\Application\Services\PublishingEngineService;
use Modules\Marketing\CampaignStudio\Domain\Enums\PublishingOperation;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\PublishingJob;
use Modules\Marketing\CampaignStudio\Presentation\Http\Resources\PublishingJobResource;

class PublishingJobController extends Controller
{
    public function __construct(
        private readonly PublishCampaignAction $publishAction,
        private readonly PublishingEngineService $publishingEngine,
    ) {}

    /** POST /mkt/studio/drafts/{draft}/publish */
    public function publish(Request $request, CampaignDraft $draft): JsonResponse
    {
        $validated = $request->validate([
            'scheduled_at' => ['nullable', 'date'],
        ]);

        $scheduledAt = isset($validated['scheduled_at']) ? Carbon::parse($validated['scheduled_at']) : null;

        $job = $this->publishAction->execute($draft, (string) $request->user()->id, $scheduledAt);

        return response()->json(['data' => new PublishingJobResource($job)], 202);
    }

    /** POST /mkt/studio/drafts/{draft}/pause */
    public function pause(Request $request, CampaignDraft $draft): JsonResponse
    {
        $job = $this->publishingEngine->queueOperation($draft, PublishingOperation::PAUSE, (string) $request->user()->id);

        return response()->json(['data' => new PublishingJobResource($job)], 202);
    }

    /** POST /mkt/studio/drafts/{draft}/resume */
    public function resume(Request $request, CampaignDraft $draft): JsonResponse
    {
        $job = $this->publishingEngine->queueOperation($draft, PublishingOperation::RESUME, (string) $request->user()->id);

        return response()->json(['data' => new PublishingJobResource($job)], 202);
    }

    /** POST /mkt/studio/drafts/{draft}/archive */
    public function archive(Request $request, CampaignDraft $draft): JsonResponse
    {
        $job = $this->publishingEngine->queueOperation($draft, PublishingOperation::ARCHIVE, (string) $request->user()->id);

        return response()->json(['data' => new PublishingJobResource($job)], 202);
    }

    /** POST /mkt/studio/jobs/{job}/retry */
    public function retry(Request $request, PublishingJob $job): JsonResponse
    {
        if (! $job->canRetry()) {
            return response()->json(['message' => 'This job cannot be retried.'], 422);
        }

        $retried = $this->publishingEngine->retry($job, (string) $request->user()->id);

        return response()->json(['data' => new PublishingJobResource($retried)]);
    }

    /** GET /mkt/studio/jobs */
    public function index(Request $request): JsonResponse
    {
        $jobs = PublishingJob::with('draft:id,name,connector_type')
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->query('connector_type'), fn ($q, $c) => $q->where('connector_type', $c))
            ->orderByDesc('created_at')
            ->paginate((int) $request->query('per_page', 25));

        return response()->json([
            'data' => PublishingJobResource::collection($jobs->items())->resolve(),
            'meta' => [
                'current_page' => $jobs->currentPage(),
                'last_page' => $jobs->lastPage(),
                'per_page' => $jobs->perPage(),
                'total' => $jobs->total(),
            ],
        ]);
    }

    /** GET /mkt/studio/jobs/stats */
    public function stats(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->publishingEngine->getQueueStats($request->only(['company_id']))]);
    }
}
