<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Modules\System\Engineering\Domain\Models\IntelKnowledgeEntry;

/**
 * Engineering Knowledge Base (TASK-ENG-V2-004).
 *
 * The knowledge base is the platform's ONLY learned state. Entries are
 * derived facts recomputed deterministically from source history by the
 * IntelLearningEngine — they are advisory and are never consulted by the
 * Repair Platform, Self-Healing Pipeline, or Guardian when making
 * decisions.
 */
class IntelKnowledgeBase
{
    public function __construct(
        private readonly IntelConfidenceScorer $scorer,
    ) {}

    /**
     * Deterministic upsert: sets absolute computed totals (never
     * increments), so repeated learning runs converge on identical rows.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function upsert(
        string $companyId,
        string $category,
        string $failureType,
        string $rootCause,
        array $attributes,
    ): IntelKnowledgeEntry {
        $successCount = (int) ($attributes['success_count'] ?? 0);
        $failureCount = (int) ($attributes['failure_count'] ?? 0);

        return IntelKnowledgeEntry::updateOrCreate(
            [
                'company_id'   => $companyId,
                'category'     => $category,
                'failure_type' => $failureType,
                'root_cause'   => $rootCause,
            ],
            array_merge($attributes, [
                'confidence' => $this->scorer->entryConfidence($successCount, $failureCount),
            ]),
        );
    }

    /**
     * @return Collection<int, IntelKnowledgeEntry>
     */
    public function list(string $companyId, ?string $category = null): Collection
    {
        return IntelKnowledgeEntry::query()
            ->where('company_id', $companyId)
            ->when($category, fn ($q) => $q->where('category', $category))
            ->orderByDesc('occurrences')
            ->get();
    }

    /**
     * Repair Recommendation Engine: rank known resolution approaches for
     * a failure signature by confidence, then by evidence volume.
     *
     * Advisory only — consumers may show these next to a repair session;
     * nothing in the repair flow depends on them.
     *
     * @return array<int, array<string, mixed>>
     */
    public function recommendForFailure(string $companyId, string $failureType, ?string $rootCause = null): array
    {
        $entries = IntelKnowledgeEntry::query()
            ->where('company_id', $companyId)
            ->where('category', 'repair')
            ->where('failure_type', $failureType)
            ->when($rootCause, fn ($q) => $q->where('root_cause', $rootCause))
            ->orderByDesc('confidence')
            ->orderByDesc('occurrences')
            ->limit(5)
            ->get();

        return $entries->map(fn (IntelKnowledgeEntry $entry): array => [
            'root_cause'          => $entry->root_cause,
            'resolution_approach' => $entry->resolution_approach,
            'confidence'          => $entry->confidence,
            'occurrences'         => $entry->occurrences,
            'success_count'       => $entry->success_count,
            'failure_count'       => $entry->failure_count,
            'repair_confidence'   => $this->scorer->repairConfidence($companyId, $failureType, $entry->root_cause),
        ])->all();
    }
}
