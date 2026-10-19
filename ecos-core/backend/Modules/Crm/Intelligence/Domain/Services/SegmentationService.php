<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Intelligence\Domain\Enums\RfmSegment;
use Modules\Crm\Intelligence\Domain\Models\CustomerSegment;

/**
 * Customer segmentation over the derived RFM segments.
 *
 * Assignment is deterministic (RfmSegment::fromScores); this service resolves a
 * segment key to its definition and reports the portfolio distribution across
 * segments — the raw material for retention targeting.
 */
final class SegmentationService
{
    /** Resolve a segment key to its definition (company override first, else system template). */
    public function definition(?string $companyId, string $key): ?CustomerSegment
    {
        return CustomerSegment::query()
            ->where('key', $key)
            ->where(function ($q) use ($companyId): void {
                $q->where('company_id', $companyId)->orWhereNull('company_id');
            })
            ->orderByRaw('company_id is null')   // prefer a company-specific override
            ->first();
    }

    /** @return array<int, array<string, mixed>> segment definitions, ordered by priority */
    public function catalog(?string $companyId): array
    {
        return CustomerSegment::query()
            ->where(function ($q) use ($companyId): void {
                $q->where('company_id', $companyId)->orWhereNull('company_id');
            })
            ->orderBy('priority')
            ->get()
            ->unique('key')
            ->values()
            ->map(fn (CustomerSegment $s) => [
                'key' => $s->key,
                'name' => $s->name,
                'description' => $s->description,
                'color' => $s->color,
                'priority' => $s->priority,
                'is_retention_focus' => $s->is_retention_focus,
            ])->all();
    }

    /**
     * Count of customers in each RFM segment for a company.
     *
     * @return array<int, array<string, mixed>>
     */
    public function distribution(string $companyId): array
    {
        $counts = DB::table('crm_customer_intelligence_profiles')
            ->where('company_id', $companyId)
            ->whereNotNull('rfm_segment')
            ->groupBy('rfm_segment')
            ->selectRaw('rfm_segment, count(*) as total')
            ->pluck('total', 'rfm_segment');

        return collect(RfmSegment::cases())->map(fn (RfmSegment $s) => [
            'key' => $s->value,
            'label' => $s->label(),
            'is_retention_focus' => $s->isRetentionFocus(),
            'customers' => (int) ($counts[$s->value] ?? 0),
        ])->all();
    }
}
