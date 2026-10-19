<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Actions\ProcessApprovalDecisionAction;
use Modules\Marketing\CampaignStudio\Application\Actions\SubmitForApprovalAction;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignApprovalService;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignApproval;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Presentation\Http\Resources\CampaignApprovalResource;

class CampaignApprovalController extends Controller
{
    public function __construct(
        private readonly SubmitForApprovalAction $submitAction,
        private readonly ProcessApprovalDecisionAction $decisionAction,
        private readonly CampaignApprovalService $approvalService,
    ) {}

    /** POST /mkt/studio/drafts/{draft}/submit-for-approval */
    public function submit(Request $request, CampaignDraft $draft): JsonResponse
    {
        $validated = $request->validate([
            'workflow_id' => ['nullable', 'uuid'],
        ]);

        $approval = $this->submitAction->execute($draft, (string) $request->user()->id, $validated['workflow_id'] ?? null);

        return response()->json(['data' => new CampaignApprovalResource($approval->load('workflowTemplate.steps'))]);
    }

    /** GET /mkt/studio/drafts/{draft}/approval */
    public function show(CampaignDraft $draft): JsonResponse
    {
        $approval = $draft->currentApproval?->load(['workflowTemplate.steps', 'decisions']);

        return response()->json(['data' => $approval ? new CampaignApprovalResource($approval) : null]);
    }

    /** POST /mkt/studio/approvals/{approval}/decide */
    public function decide(Request $request, CampaignApproval $approval): JsonResponse
    {
        $validated = $request->validate([
            'decision' => ['required', 'in:approved,rejected,skipped'],
            'notes' => ['nullable', 'string'],
        ]);

        $decision = $this->decisionAction->execute(
            $approval,
            $validated['decision'],
            (string) $request->user()->id,
            $validated['notes'] ?? null,
        );

        return response()->json(['data' => $decision]);
    }

    /** DELETE /mkt/studio/approvals/{approval}/cancel */
    public function cancel(Request $request, CampaignApproval $approval): JsonResponse
    {
        $this->approvalService->cancel($approval, (string) $request->user()->id);

        return response()->json(['message' => 'Approval cancelled.']);
    }

    /** GET /mkt/studio/approvals/pending */
    public function pending(Request $request): JsonResponse
    {
        $approvals = $this->approvalService->getPendingForUser(
            (string) $request->user()->id,
            $request->user()->role ?? '',
        );

        return response()->json(['data' => CampaignApprovalResource::collection($approvals)->resolve()]);
    }
}
