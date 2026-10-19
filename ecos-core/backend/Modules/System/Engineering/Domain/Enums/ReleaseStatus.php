<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Enums;
enum ReleaseStatus: string {
    case Draft          = 'draft';
    case Collecting     = 'collecting';
    case Validating     = 'validating';
    case Ready          = 'ready';
    case ApprovalPending = 'approval_pending';
    case Approved       = 'approved';
    case Rejected       = 'rejected';
    case Queued         = 'queued';
    case PipelineRunning = 'pipeline_running';
    case PipelineFailed  = 'pipeline_failed';
    case Released       = 'released';
    case Cancelled      = 'cancelled';
    case Archived       = 'archived';

    public function label(): string {
        return match($this) {
            self::Draft           => 'Draft',
            self::Collecting      => 'Collecting',
            self::Validating      => 'Validating',
            self::Ready           => 'Ready',
            self::ApprovalPending => 'Approval Pending',
            self::Approved        => 'Approved',
            self::Rejected        => 'Rejected',
            self::Queued          => 'Queued',
            self::PipelineRunning => 'Pipeline Running',
            self::PipelineFailed  => 'Pipeline Failed',
            self::Released        => 'Released',
            self::Cancelled       => 'Cancelled',
            self::Archived        => 'Archived',
        };
    }

    public function isTerminal(): bool {
        return in_array($this, [self::Released, self::Cancelled, self::Archived, self::Rejected]);
    }

    public function isActive(): bool {
        return in_array($this, [self::Collecting, self::Validating, self::Ready, self::ApprovalPending, self::Approved, self::Queued, self::PipelineRunning]);
    }

    public function canTransitionTo(self $next): bool {
        return in_array($next, match($this) {
            self::Draft           => [self::Collecting, self::Cancelled],
            self::Collecting      => [self::Validating, self::Draft, self::Cancelled],
            self::Validating      => [self::Ready, self::Draft, self::Cancelled],
            self::Ready           => [self::ApprovalPending, self::Validating, self::Cancelled],
            self::ApprovalPending => [self::Approved, self::Rejected, self::Cancelled],
            self::Approved        => [self::Queued, self::Cancelled],
            self::Rejected        => [self::Draft, self::Cancelled],
            self::Queued          => [self::PipelineRunning, self::Cancelled],
            self::PipelineRunning => [self::Released, self::PipelineFailed],
            self::PipelineFailed  => [self::Queued, self::Cancelled],
            self::Released        => [self::Archived],
            self::Cancelled       => [self::Draft],
            self::Archived        => [],
        });
    }
}
