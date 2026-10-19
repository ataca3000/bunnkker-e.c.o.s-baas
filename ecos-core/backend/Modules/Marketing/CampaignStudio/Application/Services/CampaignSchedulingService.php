<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Carbon\Carbon;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignScheduleTask;

class CampaignSchedulingService
{
    public function __construct(private readonly PublishingEngineService $publishingEngine) {}

    public function schedulePublish(CampaignDraft $draft, string $scheduledFor, string $timezone, string $userId): CampaignScheduleTask
    {
        $scheduledAt = Carbon::createFromFormat('Y-m-d H:i:s', $scheduledFor, $timezone)->setTimezone('UTC');

        // Cancel existing pending publish tasks
        CampaignScheduleTask::where('campaign_draft_id', $draft->id)
            ->where('task_type', 'publish')
            ->where('status', 'pending')
            ->update(['status' => 'cancelled']);

        $publishingJob = $this->publishingEngine->queuePublish($draft, $userId, $scheduledAt);

        return CampaignScheduleTask::create([
            'campaign_draft_id' => $draft->id,
            'task_type' => 'publish',
            'scheduled_for' => $scheduledAt,
            'timezone' => $timezone,
            'status' => 'pending',
            'publishing_job_id' => $publishingJob->id,
            'created_by' => $userId,
        ]);
    }

    public function schedulePause(CampaignDraft $draft, string $scheduledFor, string $timezone, string $userId): CampaignScheduleTask
    {
        $scheduledAt = Carbon::createFromFormat('Y-m-d H:i:s', $scheduledFor, $timezone)->setTimezone('UTC');

        return CampaignScheduleTask::create([
            'campaign_draft_id' => $draft->id,
            'task_type' => 'pause',
            'scheduled_for' => $scheduledAt,
            'timezone' => $timezone,
            'status' => 'pending',
            'created_by' => $userId,
        ]);
    }

    public function cancelTask(CampaignScheduleTask $task): void
    {
        $task->update(['status' => 'cancelled']);
    }

    public function getPendingTasks(): \Illuminate\Database\Eloquent\Collection
    {
        return CampaignScheduleTask::with('draft')
            ->where('status', 'pending')
            ->where('scheduled_for', '<=', now())
            ->get();
    }
}
