<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Enums;

enum ReviewRecommendation: string
{
    case Approve             = 'approve';
    case ApproveWithWarnings = 'approve_with_warnings';
    case NeedsReview         = 'needs_review';
    case Reject              = 'reject';
    case CriticalBlock       = 'critical_block';

    public function isBlocking(): bool
    {
        return in_array($this, [self::Reject, self::CriticalBlock]);
    }

    public function label(): string
    {
        return match($this) {
            self::Approve             => 'Approve',
            self::ApproveWithWarnings => 'Approve with Warnings',
            self::NeedsReview         => 'Needs Review',
            self::Reject              => 'Reject',
            self::CriticalBlock       => 'Critical Block',
        };
    }

    public static function fromScore(float $score, bool $hasCriticalRisk): self
    {
        if ($hasCriticalRisk) return self::CriticalBlock;
        if ($score >= 90) return self::Approve;
        if ($score >= 75) return self::ApproveWithWarnings;
        if ($score >= 60) return self::NeedsReview;
        if ($score >= 40) return self::Reject;
        return self::CriticalBlock;
    }
}
