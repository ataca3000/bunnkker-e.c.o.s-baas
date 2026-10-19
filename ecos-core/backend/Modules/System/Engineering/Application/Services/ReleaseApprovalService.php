<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;
use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Enums\ApprovalStatus;
use Modules\System\Engineering\Domain\Enums\ReleaseStatus;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseApproval;

final class ReleaseApprovalService
{
    public function __construct(private readonly ReleaseAuditService $audit) {}

    public function initializeApprovalWorkflow(EngineeringRelease $release): array
    {
        EngineeringReleaseApproval::where('release_id', $release->id)->delete();
        $levels = [
            ['approval_level' => 'engineering', 'approval_role' => 'Engineering Lead',    'sequence' => 1, 'is_required' => true,  'ttl_hours' => 48],
            ['approval_level' => 'lead',        'approval_role' => 'Technical Lead',       'sequence' => 2, 'is_required' => true,  'ttl_hours' => 48],
            ['approval_level' => 'cto',         'approval_role' => 'CTO',                  'sequence' => 3, 'is_required' => $release->is_breaking_change, 'ttl_hours' => 72],
            ['approval_level' => 'final',       'approval_role' => 'Release Manager',      'sequence' => 4, 'is_required' => true,  'ttl_hours' => 24],
        ];
        $created = [];
        foreach ($levels as $level) {
            $created[] = EngineeringReleaseApproval::create(array_merge($level, [
                'company_id'   => $release->company_id,
                'release_id'   => $release->id,
                'status'       => ApprovalStatus::Pending->value,
                'requested_at' => now(),
                'expires_at'   => now()->addHours($level['ttl_hours']),
            ]));
        }
        return $created;
    }

    public function decide(EngineeringReleaseApproval $approval, string $decision, ?string $approverId, string $comment = ''): EngineeringReleaseApproval
    {
        return DB::transaction(function () use ($approval, $decision, $approverId, $comment) {
            $status = $decision === 'approved' ? ApprovalStatus::Approved : ApprovalStatus::Rejected;
            $approval->update([
                'status'       => $status->value,
                'decision'     => $decision,
                'approver_id'  => $approverId,
                'comment'      => $comment,
                'decided_at'   => now(),
            ]);
            $release = $approval->release;
            $this->audit->record($release, 'approval_decision', $approverId, null, null, "Level [{$approval->approval_level}]: {$decision}");

            if ($status === ApprovalStatus::Rejected) {
                $release->update(['status' => ReleaseStatus::Rejected->value, 'rejected_at' => now(), 'rejected_by' => $approverId, 'rejection_reason' => $comment]);
                return $approval;
            }

            $pending = EngineeringReleaseApproval::where('release_id', $release->id)
                ->where('is_required', true)
                ->where('status', '!=', ApprovalStatus::Approved->value)
                ->count();
            if ($pending === 0) {
                $release->update(['status' => ReleaseStatus::Approved->value, 'approved_at' => now(), 'approved_by' => $approverId]);
                $this->audit->record($release, 'release_approved', $approverId, ReleaseStatus::ApprovalPending->value, ReleaseStatus::Approved->value, 'All approvals granted — release approved');
            }
            return $approval->fresh();
        });
    }

    public function skip(EngineeringReleaseApproval $approval, ?string $actorId = null, string $reason = ''): void
    {
        $approval->update(['status' => ApprovalStatus::Skipped->value, 'comment' => $reason, 'decided_at' => now()]);
        $this->audit->record($approval->release, 'approval_skipped', $actorId, null, null, "Approval [{$approval->approval_level}] skipped: {$reason}");
    }

    public function getWorkflowStatus(EngineeringRelease $release): array
    {
        $approvals  = EngineeringReleaseApproval::where('release_id', $release->id)->orderBy('sequence')->get();
        $allGranted = $approvals->where('is_required', true)->every(fn($a) => $a->status === ApprovalStatus::Approved);
        return [
            'approvals'     => $approvals,
            'all_granted'   => $allGranted,
            'pending_count' => $approvals->where('status', ApprovalStatus::Pending->value)->count(),
            'rejected_any'  => $approvals->where('status', ApprovalStatus::Rejected->value)->isNotEmpty(),
        ];
    }
}
