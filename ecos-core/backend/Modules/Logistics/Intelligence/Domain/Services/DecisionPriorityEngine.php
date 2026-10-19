<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\Services;

use Modules\Logistics\Intelligence\Domain\ValueObjects\Recommendation;

/**
 * Ranks recommendations into the order a duty manager should work them.
 *
 * ┌─ PURE FUNCTION — NO STATE, NO IO ───────────────────────────────────────┐
 * │ Priority is derived only from a recommendation's own severity and a      │
 * │ small, transparent bump for how many independent reasons it carries.     │
 * │ It reads nothing, writes nothing, and returns a NEW ranked list — the    │
 * │ input recommendations are immutable and untouched.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The score is deliberately explainable: severity sets the floor, corroborating
 * evidence nudges it, and it is capped at 100. There is no opaque weighting.
 */
class DecisionPriorityEngine
{
    /**
     * @param  list<Recommendation>  $recommendations
     * @return list<Recommendation>  Highest priority first.
     */
    public function prioritise(array $recommendations): array
    {
        $ranked = array_map(
            fn (Recommendation $r) => $r->withPriority($this->score($r)),
            $recommendations,
        );

        usort(
            $ranked,
            static fn (Recommendation $a, Recommendation $b) => [$b->priority, $b->severity->rank()]
                <=> [$a->priority, $a->severity->rank()],
        );

        return array_values($ranked);
    }

    /**
     * Severity floor, plus up to a small bump for corroborating reasons, capped
     * at 100. Transparent by construction.
     */
    private function score(Recommendation $recommendation): int
    {
        $base = $recommendation->severity->basePriority();

        // Each rationale beyond the first adds a little weight — more
        // independent evidence, higher confidence — but never enough to jump a
        // severity band.
        $corroboration = min(9, max(0, count($recommendation->rationale) - 1) * 3);

        return min(100, $base + $corroboration);
    }
}
