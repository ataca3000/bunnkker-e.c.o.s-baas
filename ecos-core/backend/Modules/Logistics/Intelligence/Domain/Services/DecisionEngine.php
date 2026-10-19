<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Intelligence\Domain\Enums\RecommendationSeverity;
use Modules\Logistics\Intelligence\Domain\ValueObjects\Recommendation;
use Modules\Logistics\Operations\Domain\Services\CrossModuleValidationService;

/**
 * The central Logistics Decision Engine.
 *
 * ┌─ ORCHESTRATES SUGGESTIONS, HOLDS NO AUTHORITY ──────────────────────────┐
 * │ It gathers recommendations from the recommendation and conflict engines, │
 * │ ranks them with the priority engine, and frames them against the         │
 * │ cross-module readiness verdict. It decides NOTHING on its own and acts   │
 * │ on nothing — acting means calling the owning module's endpoint.          │
 * │                                                                          │
 * │ Read-model only. Everything is derived on demand; nothing is stored.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class DecisionEngine
{
    public function __construct(
        private readonly RecommendationService $recommendations,
        private readonly ConflictRecommendationEngine $conflicts,
        private readonly DecisionPriorityEngine $priority,
        private readonly CrossModuleValidationService $validation,
    ) {}

    /**
     * The full decision-support bundle: ranked recommendations framed against
     * the operation's overall readiness.
     *
     * @return array<string, mixed>
     */
    public function decide(?string $companyId = null): array
    {
        $ranked = $this->rankedRecommendations($companyId);
        $report = $this->validation->report($companyId);

        return [
            'generated_at' => Carbon::now()->toIso8601String(),
            'overall_status' => $report['overall_status'],
            'recommendation_count' => count($ranked),
            'by_severity' => $this->countBySeverity($ranked),
            'top_priority' => $ranked === [] ? null : $ranked[0]->toArray(),
            'recommendations' => array_map(static fn (Recommendation $r) => $r->toArray(), $ranked),
        ];
    }

    /**
     * The ranked recommendations only.
     *
     * @return list<array<string, mixed>>
     */
    public function recommendations(?string $companyId = null): array
    {
        return array_map(
            static fn (Recommendation $r) => $r->toArray(),
            $this->rankedRecommendations($companyId),
        );
    }

    /**
     * The prioritised work queue — a compact, ordered view for a duty manager.
     *
     * @return list<array<string, mixed>>
     */
    public function priorities(?string $companyId = null): array
    {
        return array_map(static fn (Recommendation $r) => [
            'priority' => $r->priority,
            'severity' => $r->severity->value,
            'title' => $r->title,
            'category' => $r->category,
            'action' => $r->action,
            'source_module' => $r->sourceModule,
        ], $this->rankedRecommendations($companyId));
    }

    /**
     * Conflict-specific recommendations, ranked.
     *
     * @return list<array<string, mixed>>
     */
    public function conflictRecommendations(?string $companyId = null): array
    {
        $ranked = $this->priority->prioritise($this->conflicts->generate($companyId));

        return array_map(static fn (Recommendation $r) => $r->toArray(), $ranked);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return list<Recommendation> */
    private function rankedRecommendations(?string $companyId): array
    {
        $all = [
            ...$this->recommendations->generate($companyId),
            ...$this->conflicts->generate($companyId),
        ];

        return $this->priority->prioritise($all);
    }

    /**
     * @param  list<Recommendation>  $ranked
     * @return array<string, int>
     */
    private function countBySeverity(array $ranked): array
    {
        $counts = [];

        foreach (RecommendationSeverity::cases() as $severity) {
            $counts[$severity->value] = count(array_filter(
                $ranked,
                static fn (Recommendation $r) => $r->severity === $severity,
            ));
        }

        return $counts;
    }
}
