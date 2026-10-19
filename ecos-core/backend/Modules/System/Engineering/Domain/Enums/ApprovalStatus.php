<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Enums;
enum ApprovalStatus: string {
    case Pending  = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Expired  = 'expired';
    case Skipped  = 'skipped';

    public function isTerminal(): bool {
        return in_array($this, [self::Approved, self::Rejected, self::Expired, self::Skipped]);
    }
}
