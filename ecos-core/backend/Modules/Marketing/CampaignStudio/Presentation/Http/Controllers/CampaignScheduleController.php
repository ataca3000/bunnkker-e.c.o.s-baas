<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignSchedulingService;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignScheduleTask;

class CampaignScheduleController extends Controller
{
    public function __construct(private readonly CampaignSchedulingService $schedulingService) {}

    /** POST /mkt/studio/drafts/{draft}/schedule */
    public function store(Request $request, CampaignDraft $draft): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['required', 'in:publish,pause'],
            'scheduled_at' => ['required', 'date', 'after:now'],
            'timezone' => ['nullable', 'string', 'max:100'],
        ]);

        $at = Carbon::parse($validated['scheduled_at']);
        $timezone = $validated['timezone'] ?? 'UTC';

        $task = match ($validated['action']) {
            'publish' => $this->schedulingService->schedulePublish($draft, $at, $timezone, (string) $request->user()->id),
            'pause' => $this->schedulingService->schedulePause($draft, $at, $timezone, (string) $request->user()->id),
        };

        return response()->json(['data' => $task], 201);
    }

    /** DELETE /mkt/studio/schedule-tasks/{task} */
    public function destroy(CampaignScheduleTask $task): JsonResponse
    {
        $this->schedulingService->cancelTask($task);

        return response()->json(null, 204);
    }

    /** GET /mkt/studio/drafts/{draft}/schedule */
    public function pending(CampaignDraft $draft): JsonResponse
    {
        $tasks = $this->schedulingService->getPendingTasks($draft);

        return response()->json(['data' => $tasks]);
    }
}
