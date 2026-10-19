<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchOperationsException;
use Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry;

/**
 * The append-only audit trail.
 *
 * Records the consequential actions — overrides, rejections, forced releases —
 * with WHO, WHAT, WHEN and WHY. The "why" is enforced rather than encouraged:
 * an action on the REASON_REQUIRED list cannot be recorded without one, so an
 * override can never quietly appear in the record with no explanation.
 */
class DispatchAuditService
{
    /** @param array<string, mixed>|null $changes */
    public function record(
        string $action,
        ?string $reason = null,
        ?string $companyId = null,
        ?int $sessionId = null,
        ?int $assignmentId = null,
        ?string $entityType = null,
        ?string $entityId = null,
        ?array $changes = null,
        ?int $actorId = null,
        ?string $actorName = null,
        ?string $ipAddress = null,
    ): DispatchAuditEntry {
        if (DispatchAuditEntry::actionRequiresReason($action)
            && ($reason === null || trim($reason) === '')) {
            throw DispatchOperationsException::auditReasonRequired($action);
        }

        return DispatchAuditEntry::create([
            'company_id' => $companyId,
            'dispatch_session_id' => $sessionId,
            'assignment_id' => $assignmentId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'changes' => $changes,
            'reason' => $reason,
            'performed_at' => Carbon::now(),
            'actor_id' => $actorId,
            'actor_name' => $actorName,
            'ip_address' => $ipAddress,
        ]);
    }

    /**
     * The override log — what a supervisor actually looks for after a bad
     * morning.
     *
     * @return \Illuminate\Support\Collection<int, DispatchAuditEntry>
     */
    public function overrides(?string $companyId = null, int $limit = 50): \Illuminate\Support\Collection
    {
        return DispatchAuditEntry::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('action', [
                DispatchAuditEntry::ACTION_OVERRIDDEN,
                DispatchAuditEntry::ACTION_CONFLICT_OVERRIDDEN,
                DispatchAuditEntry::ACTION_LOCK_BROKEN,
            ])
            ->latest('performed_at')
            ->limit($limit)
            ->get();
    }

    /**
     * How often decisions are being overridden.
     *
     * A rising override rate usually means the rules no longer match reality —
     * which is a signal about the policy, not about the dispatchers.
     *
     * @return array<string, mixed>
     */
    public function overrideRate(?string $companyId, Carbon $from, Carbon $to): array
    {
        $base = DispatchAuditEntry::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereBetween('performed_at', [$from, $to]);

        $total = (clone $base)->count();
        $overrides = (clone $base)->whereIn('action', [
            DispatchAuditEntry::ACTION_OVERRIDDEN,
            DispatchAuditEntry::ACTION_CONFLICT_OVERRIDDEN,
            DispatchAuditEntry::ACTION_LOCK_BROKEN,
        ])->count();

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'total_actions' => $total,
            'override_actions' => $overrides,
            // Null rather than zero when nothing happened — a rate computed
            // from no data is not a rate.
            'override_rate' => $total > 0 ? round($overrides / $total, 4) : null,
        ];
    }
}
