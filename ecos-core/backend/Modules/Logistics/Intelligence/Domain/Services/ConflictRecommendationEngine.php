<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\Services;

use Modules\Logistics\Dispatch\Domain\Enums\ConflictStatus;
use Modules\Logistics\Dispatch\Domain\Models\DispatchConflict;
use Modules\Logistics\Intelligence\Domain\Enums\RecommendationSeverity;
use Modules\Logistics\Intelligence\Domain\ValueObjects\Recommendation;

/**
 * Recommends how to clear outstanding dispatch conflicts.
 *
 * ┌─ IT SUGGESTS WHERE TO FIX, IT NEVER FIXES ──────────────────────────────┐
 * │ Each recommendation routes the operator to the module that OWNS the      │
 * │ conflict — the authority Dispatch already recorded. Intelligence does     │
 * │ not re-judge that authority and does not resolve anything; resolution    │
 * │ stays with ConflictResolutionService and the owning module.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Read-only: it reads the outstanding conflicts Dispatch persisted and groups
 * them; it writes nothing.
 */
class ConflictRecommendationEngine
{
    /** How each authority's conflicts should be approached. */
    private const GUIDANCE = [
        'fleet' => 'Clear the vehicle fitness issue in Fleet — inspection or maintenance.',
        'drivers' => 'Resolve driver availability in the Drivers module.',
        'network' => 'Add or rebalance capacity in Network.',
        'distribution' => 'Reconcile the trip assignment in Distribution.',
        'dispatch' => 'Reassign or override in the Dispatch Command Center.',
    ];

    /**
     * @return list<Recommendation>
     */
    public function generate(?string $companyId = null): array
    {
        $outstanding = DispatchConflict::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('status', [
                ConflictStatus::Open->value,
                ConflictStatus::Acknowledged->value,
            ])
            ->get();

        if ($outstanding->isEmpty()) {
            return [];
        }

        // Group by the authority Dispatch already assigned — never re-derived.
        $byAuthority = [];
        foreach ($outstanding as $conflict) {
            $authority = $conflict->authority();
            $byAuthority[$authority] ??= ['count' => 0, 'blocking' => 0];
            $byAuthority[$authority]['count']++;
            if ($conflict->conflict_type->isBlocking()) {
                $byAuthority[$authority]['blocking']++;
            }
        }

        $out = [];

        foreach ($byAuthority as $authority => $tally) {
            $blocking = $tally['blocking'];
            $count = $tally['count'];

            $out[] = new Recommendation(
                type: 'conflict.'.$authority,
                category: 'dispatch',
                severity: $blocking > 0 ? RecommendationSeverity::Critical : RecommendationSeverity::Medium,
                title: ucfirst($authority)." owns {$count} outstanding conflict(s)",
                detail: $blocking > 0
                    ? "{$blocking} of {$count} are blocking releases."
                    : "{$count} advisory conflict(s) are outstanding.",
                action: self::GUIDANCE[$authority] ?? 'Resolve in the owning module.',
                sourceModule: $authority,
                rationale: ["Dispatch attributes {$count} outstanding conflict(s) to {$authority}."],
                impact: $blocking > 0 ? 'Unblocks stalled releases.' : 'Reduces advisory noise.',
            );
        }

        return $out;
    }
}
