<?php

declare(strict_types=1);

namespace Modules\Marketing\MappingEngine\Application\Services;

use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Assets\Domain\Models\MarketingAssetRelationship;
use Modules\Marketing\MappingEngine\Domain\Models\MappingProfile;

/**
 * Generates auto-mapping suggestions for newly discovered assets.
 *
 * Matches assets against active MappingProfiles and creates
 * pending MarketingAssetRelationship records (is_auto_suggested = true)
 * for users to accept or reject.
 */
final class MappingSuggestionService
{
    /**
     * Generate suggestions for a single newly discovered asset.
     */
    public function suggestForAsset(MarketingAsset $asset, ?string $companyId): void
    {
        $profiles = MappingProfile::query()
            ->where('is_active', true)
            ->where('auto_apply', true)
            ->where(function ($q) use ($asset): void {
                $q->whereNull('connector_type')
                    ->orWhere('connector_type', $asset->connector_type->value);
            })
            ->where(function ($q) use ($companyId): void {
                $q->whereNull('company_id')
                    ->orWhere('company_id', $companyId);
            })
            ->with('rules')
            ->get();

        $assetData = [
            'name' => $asset->name,
            'external_id' => $asset->external_id,
            'asset_type' => $asset->asset_type->value,
        ];

        foreach ($profiles as $profile) {
            foreach ($profile->rules as $rule) {
                if (! $rule->matchesData($assetData)) {
                    continue;
                }

                // Avoid duplicates
                $exists = MarketingAssetRelationship::where('marketing_asset_id', $asset->id)
                    ->where('related_type', $rule->related_type)
                    ->where('related_id', $rule->related_id)
                    ->exists();

                if ($exists) {
                    continue;
                }

                // Calculate confidence: 100 for exact name match, 80 for contains
                $confidence = $rule->match_field === 'name' ? 98 : 80;

                MarketingAssetRelationship::create([
                    'marketing_asset_id' => $asset->id,
                    'related_type' => $rule->related_type,
                    'related_id' => $rule->related_id,
                    'is_auto_suggested' => true,
                    'confidence' => $confidence,
                    'mapped_at' => now(),
                ]);
            }
        }
    }

    /**
     * Get all pending (un-reviewed) suggestions for a company.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, MarketingAssetRelationship>
     */
    public function pendingForCompany(string $companyId): \Illuminate\Database\Eloquent\Collection
    {
        return MarketingAssetRelationship::whereHas('asset', function ($q) use ($companyId): void {
            $q->where('company_id', $companyId);
        })
            ->where('is_auto_suggested', true)
            ->whereNull('accepted_at')
            ->whereNull('rejected_at')
            ->orderByDesc('confidence')
            ->with('asset')
            ->get();
    }
}
