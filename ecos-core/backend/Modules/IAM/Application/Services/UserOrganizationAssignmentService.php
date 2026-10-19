<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Modules\IAM\Domain\Models\UserOrganizationAssignment;

/**
 * Assigns users to organization units (ADR-040). Additive — a user may belong to many
 * units of many types. Unit types without a table yet (department/region/business_unit/
 * cost_center) are stored by type+id and become FK-backed when those modules land.
 */
class UserOrganizationAssignmentService
{
    public const TYPES = [
        'company', 'branch', 'warehouse', 'department', 'business_unit',
        'region', 'channel', 'team', 'cost_center',
    ];

    public function __construct(private readonly UserAuditService $audit) {}

    public function assign(User $user, string $orgType, ?string $orgId, ?string $label = null, bool $primary = false, ?int $actorId = null): UserOrganizationAssignment
    {
        $this->assertValidType($orgType);

        $assignment = UserOrganizationAssignment::firstOrNew([
            'user_id' => $user->getKey(),
            'org_type' => $orgType,
            'org_id' => $orgId,
        ]);
        $assignment->org_label = $label;
        $assignment->is_primary = $primary;
        $assignment->assigned_by = $actorId;
        $assignment->assigned_at = now();
        $assignment->save();

        if ($primary) {
            UserOrganizationAssignment::where('user_id', $user->getKey())
                ->where('org_type', $orgType)
                ->where('id', '!=', $assignment->id)
                ->update(['is_primary' => false]);
        }

        $this->audit->log('organization_assigned', $user, [], ['type' => $orgType, 'id' => $orgId, 'primary' => $primary]);

        return $assignment;
    }

    public function unassign(User $user, string $orgType, ?string $orgId): void
    {
        UserOrganizationAssignment::where('user_id', $user->getKey())
            ->where('org_type', $orgType)
            ->where('org_id', $orgId)
            ->delete();

        $this->audit->log('organization_unassigned', $user, ['type' => $orgType, 'id' => $orgId], []);
    }

    private function assertValidType(string $orgType): void
    {
        if (! in_array($orgType, self::TYPES, true)) {
            throw new \InvalidArgumentException("Unknown organization unit type '{$orgType}'.");
        }
    }
}
