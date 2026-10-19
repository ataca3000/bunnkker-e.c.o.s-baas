<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Illuminate\Support\Collection;
use Modules\Marketing\CampaignStudio\Domain\Enums\ApprovalStatus;
use Modules\Marketing\CampaignStudio\Domain\Enums\CampaignInternalStatus;
use Modules\Marketing\CampaignStudio\Domain\Models\ApprovalWorkflowTemplate;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignApproval;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignApprovalDecision;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;

class CampaignApprovalService
{
    public function submit(CampaignDraft $draft, string $submittedBy, ?string $workflowId = null): CampaignApproval
    {
        // Cancel any existing pending approval
        $draft->approvals()->where('status', ApprovalStatus::PENDING)->update([
            'status' => ApprovalStatus::CANCELLED,
            'completed_at' => now(),
        ]);

        // Resolve workflow template
        $workflowId ??= $this->resolveDefaultWorkflow($draft)?->id;

        $approval = CampaignApproval::create([
            'campaign_draft_id' => $draft->id,
            'workflow_template_id' => $workflowId,
            'current_step_order' => 1,
            'status' => ApprovalStatus::PENDING,
            'submitted_by' => $submittedBy,
            'submitted_at' => now(),
        ]);

        $draft->update([
            'internal_status' => CampaignInternalStatus::PENDING_REVIEW,
            'submitted_for_approval_at' => now(),
        ]);

        return $approval->fresh(['workflowTemplate.steps']);
    }

    public function decide(
        CampaignApproval $approval,
        string $decision,
        string $decidedBy,
        ?string $notes = null,
    ): CampaignApprovalDecision {
        // Resolve step info
        $stepOrder = $approval->current_step_order;
        $step = $approval->workflowTemplate?->steps->firstWhere('step_order', $stepOrder);

        $decisionRecord = CampaignApprovalDecision::create([
            'campaign_approval_id' => $approval->id,
            'workflow_step_id' => $step?->id,
            'step_order' => $stepOrder,
            'step_name' => $step?->step_name ?? "Step {$stepOrder}",
            'decision' => $decision,
            'decided_by' => $decidedBy,
            'notes' => $notes,
            'decided_at' => now(),
        ]);

        if ($decision === ApprovalStatus::REJECTED->value) {
            $approval->update([
                'status' => ApprovalStatus::REJECTED,
                'completed_at' => now(),
                'rejection_reason' => $notes,
            ]);
            $approval->draft->update(['internal_status' => CampaignInternalStatus::REJECTED]);

        } elseif ($decision === ApprovalStatus::APPROVED->value) {
            $totalSteps = $approval->workflowTemplate?->steps->count() ?? 1;

            if ($stepOrder >= $totalSteps) {
                // All steps approved
                $approval->update([
                    'status' => ApprovalStatus::APPROVED,
                    'completed_at' => now(),
                ]);
                $approval->draft->update(['internal_status' => CampaignInternalStatus::APPROVED]);
            } else {
                // Advance to next step
                $approval->update(['current_step_order' => $stepOrder + 1]);
            }
        }

        return $decisionRecord;
    }

    public function cancel(CampaignApproval $approval, string $cancelledBy): void
    {
        $approval->update([
            'status' => ApprovalStatus::CANCELLED,
            'completed_at' => now(),
        ]);
        $approval->draft->update(['internal_status' => CampaignInternalStatus::DRAFT]);
    }

    public function getPendingForUser(string $userId, string $role): Collection
    {
        return CampaignApproval::with(['draft', 'workflowTemplate.steps'])
            ->where('status', ApprovalStatus::PENDING)
            ->get()
            ->filter(function (CampaignApproval $approval) use ($userId, $role) {
                $step = $approval->workflowTemplate?->steps->firstWhere('step_order', $approval->current_step_order);
                if (! $step) {
                    return true;
                }

                return $step->user_id_required === $userId
                    || $step->role_required === $role
                    || ($step->user_id_required === null && $step->role_required === null);
            });
    }

    private function resolveDefaultWorkflow(CampaignDraft $draft): ?ApprovalWorkflowTemplate
    {
        return ApprovalWorkflowTemplate::where('is_default', true)
            ->where(function ($q) use ($draft): void {
                $q->where('company_id', $draft->company_id)->orWhereNull('company_id');
            })
            ->where('is_active', true)
            ->orderBy('company_id', 'desc')
            ->first();
    }
}
