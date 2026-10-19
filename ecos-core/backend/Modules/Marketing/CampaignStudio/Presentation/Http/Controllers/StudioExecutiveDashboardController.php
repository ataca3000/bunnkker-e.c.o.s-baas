<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignDraftService;
use Modules\Marketing\CampaignStudio\Application\Services\PublishingEngineService;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignApproval;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignValidationResult;
use Modules\Marketing\CampaignStudio\Domain\Models\PublishingJob;

class StudioExecutiveDashboardController extends Controller
{
    public function __construct(
        private readonly CampaignDraftService $draftService,
        private readonly PublishingEngineService $publishingEngine,
    ) {}

    /** GET /mkt/studio/dashboard */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['company_id']);
        $companyId = $filters['company_id'] ?? null;

        $draftQuery = CampaignDraft::query();
        if ($companyId) {
            $draftQuery->where('company_id', $companyId);
        }

        // Campaign status breakdown
        $statusCounts = $draftQuery->selectRaw('internal_status, COUNT(*) as total')
            ->groupBy('internal_status')
            ->pluck('total', 'internal_status');

        // Pending approvals
        $pendingApprovals = CampaignApproval::where('status', 'pending')->count();

        // Publishing queue stats
        $queueStats = $this->publishingEngine->getQueueStats($filters);

        // Failed campaigns last 7 days
        $recentFailed = CampaignDraft::where('internal_status', 'failed')
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->where('updated_at', '>=', now()->subDays(7))
            ->count();

        // Validation issues
        $validationIssues = CampaignValidationResult::whereHas(
            'draft',
            fn ($q) => $companyId ? $q->where('company_id', $companyId) : $q,
        )
            ->where('is_resolved', false)
            ->where('severity', 'blocking')
            ->count();

        // Recent version changes (last 24h)
        $recentVersions = DB::table('marketing_campaign_versions')
            ->where('created_at', '>=', now()->subDay())
            ->count();

        // Campaigns published today
        $publishedToday = CampaignDraft::where('internal_status', 'published')
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->whereDate('published_at', today())
            ->count();

        return response()->json([
            'data' => [
                'campaigns' => [
                    'drafts' => (int) ($statusCounts['draft'] ?? 0),
                    'pending_review' => (int) ($statusCounts['pending_review'] ?? 0),
                    'approved' => (int) ($statusCounts['approved'] ?? 0),
                    'scheduled' => (int) ($statusCounts['scheduled'] ?? 0),
                    'active' => (int) ($statusCounts['published'] ?? 0),
                    'paused' => (int) ($statusCounts['paused'] ?? 0),
                    'archived' => (int) ($statusCounts['archived'] ?? 0),
                    'failed' => (int) ($statusCounts['failed'] ?? 0),
                    'published_today' => $publishedToday,
                ],
                'approvals' => [
                    'pending' => $pendingApprovals,
                ],
                'publishing_queue' => $queueStats,
                'health' => [
                    'blocking_validation_issues' => $validationIssues,
                    'recent_failures_7d' => $recentFailed,
                    'version_changes_24h' => $recentVersions,
                ],
            ],
        ]);
    }

    /** GET /mkt/studio/dashboard/pending-approvals */
    public function pendingApprovals(Request $request): JsonResponse
    {
        $approvals = CampaignApproval::with(['draft:id,name,connector_type,internal_status'])
            ->where('status', 'pending')
            ->orderBy('submitted_at')
            ->limit(20)
            ->get();

        return response()->json(['data' => $approvals]);
    }

    /** GET /mkt/studio/dashboard/publishing-queue */
    public function publishingQueue(Request $request): JsonResponse
    {
        $jobs = PublishingJob::with('draft:id,name,connector_type')
            ->whereIn('status', ['queued', 'processing', 'retrying'])
            ->orderBy('scheduled_at')
            ->limit(20)
            ->get();

        return response()->json(['data' => $jobs]);
    }
}
