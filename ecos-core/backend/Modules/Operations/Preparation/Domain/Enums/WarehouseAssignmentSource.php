<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum WarehouseAssignmentSource: string
{
    /** Assigned automatically via a WarehouseAssignmentPolicy match. */
    case AutoPolicy = 'auto_policy';

    /** Manually overridden by a supervisor after initial assignment. */
    case ManualOverride = 'manual_override';

    /** Fallback: channel has a single default warehouse configured. */
    case ChannelDefault = 'channel_default';

    /** No policy matched and no default exists — requires manual resolution. */
    case Unassigned = 'unassigned';

    /** Assigned automatically via branch coverage — TASK-BRANCH-ASSIGNMENT-ENGINE-001. */
    case BranchCoverage = 'branch_coverage';

    /** No active branch covers the delivery destination — operational triage required. */
    case NoBranchCoverage = 'no_branch_coverage';

    public function label(): string
    {
        return match ($this) {
            self::AutoPolicy      => 'Auto (Policy)',
            self::ManualOverride  => 'Manual Override',
            self::ChannelDefault  => 'Channel Default',
            self::Unassigned      => 'Unassigned',
            self::BranchCoverage  => 'Auto (Branch Coverage)',
            self::NoBranchCoverage => 'No Branch Coverage',
        };
    }

    public function isAuto(): bool
    {
        return in_array($this, [self::AutoPolicy, self::ChannelDefault, self::BranchCoverage], true);
    }

    public function isFailure(): bool
    {
        return $this === self::NoBranchCoverage;
    }
}
