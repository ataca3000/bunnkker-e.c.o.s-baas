<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Illuminate\Support\Collection;
use Modules\Marketing\CampaignStudio\Domain\Enums\VersionChangeType;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignVersion;

class CampaignVersioningService
{
    public function snapshot(
        CampaignDraft $draft,
        VersionChangeType $changeType,
        string $userId,
        ?string $changeNote = null,
        ?array $changedFields = null,
    ): CampaignVersion {
        $versionNumber = $draft->current_version_number + 1;
        if ($changeType === VersionChangeType::INITIAL) {
            $versionNumber = 1;
        }

        $version = CampaignVersion::create([
            'campaign_draft_id' => $draft->id,
            'version_number' => $versionNumber,
            'change_type' => $changeType,
            'snapshot' => $this->buildSnapshot($draft),
            'changed_fields' => $changedFields,
            'change_note' => $changeNote,
            'changed_by_user_id' => $userId,
        ]);

        $draft->update([
            'current_version_number' => $versionNumber,
            'current_version_id' => $version->id,
        ]);

        return $version;
    }

    public function snapshotApprovalDecision(
        CampaignDraft $draft,
        string $decision,
        string $decidedBy,
        ?string $note = null,
    ): CampaignVersion {
        $versionNumber = $draft->current_version_number + 1;

        $version = CampaignVersion::create([
            'campaign_draft_id' => $draft->id,
            'version_number' => $versionNumber,
            'change_type' => VersionChangeType::APPROVAL_DECISION,
            'snapshot' => $this->buildSnapshot($draft),
            'change_note' => $note,
            'changed_by_user_id' => $decidedBy,
            'approval_decision' => $decision,
            'approved_by_user_id' => $decidedBy,
            'approval_decided_at' => now(),
        ]);

        $draft->update([
            'current_version_number' => $versionNumber,
            'current_version_id' => $version->id,
        ]);

        return $version;
    }

    public function getHistory(CampaignDraft $draft): Collection
    {
        return CampaignVersion::where('campaign_draft_id', $draft->id)
            ->orderBy('version_number')
            ->get();
    }

    public function compare(CampaignVersion $versionA, CampaignVersion $versionB): array
    {
        $snapshotA = $versionA->snapshot ?? [];
        $snapshotB = $versionB->snapshot ?? [];

        $diff = [];

        $allKeys = array_unique(array_merge(array_keys($snapshotA), array_keys($snapshotB)));

        foreach ($allKeys as $key) {
            $valA = $snapshotA[$key] ?? null;
            $valB = $snapshotB[$key] ?? null;

            if ($valA !== $valB) {
                $diff[$key] = ['from' => $valA, 'to' => $valB];
            }
        }

        return [
            'version_a' => $versionA->version_number,
            'version_b' => $versionB->version_number,
            'changed_keys' => array_keys($diff),
            'diff' => $diff,
        ];
    }

    public function restoreToVersion(CampaignDraft $draft, CampaignVersion $version, string $userId): CampaignDraft
    {
        $snapshot = $version->snapshot;

        // Only restore safe fields — never restore status or provider identity
        $restorable = array_intersect_key($snapshot, array_flip([
            'name', 'objective', 'buying_type', 'budget_type',
            'daily_budget', 'lifetime_budget', 'bid_strategy', 'optimization_goal',
            'timezone', 'start_date', 'end_date',
            'season', 'business_goal', 'tags', 'internal_notes',
            'ad_account_id', 'page_id', 'instagram_account_id', 'pixel_id', 'catalog_id',
        ]));

        $draft->update(array_merge($restorable, ['updated_by' => $userId]));

        $this->snapshot($draft, VersionChangeType::INITIAL, $userId, "Restored from version {$version->version_number}");

        return $draft->fresh();
    }

    private function buildSnapshot(CampaignDraft $draft): array
    {
        $draft->loadMissing(['audience', 'placement', 'creatives']);

        return [
            'name' => $draft->name,
            'internal_status' => $draft->internal_status?->value,
            'objective' => $draft->objective,
            'buying_type' => $draft->buying_type,
            'budget_type' => $draft->budget_type?->value,
            'daily_budget' => $draft->daily_budget,
            'lifetime_budget' => $draft->lifetime_budget,
            'bid_strategy' => $draft->bid_strategy,
            'optimization_goal' => $draft->optimization_goal,
            'timezone' => $draft->timezone,
            'start_date' => $draft->start_date?->toIso8601String(),
            'end_date' => $draft->end_date?->toIso8601String(),
            'season' => $draft->season,
            'business_goal' => $draft->business_goal,
            'initiative_id' => $draft->initiative_id,
            'company_id' => $draft->company_id,
            'brand_id' => $draft->brand_id,
            'channel_id' => $draft->channel_id,
            'campaign_owner_id' => $draft->campaign_owner_id,
            'ad_account_id' => $draft->ad_account_id,
            'pixel_id' => $draft->pixel_id,
            'tags' => $draft->tags,
            'audience' => $draft->audience?->toArray(),
            'placement' => $draft->placement?->toArray(),
            'creatives_count' => $draft->creatives->count(),
        ];
    }
}
