<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Application\Actions;

use Modules\Marketing\Assets\Domain\Events\AssetMapped;
use Modules\Marketing\Assets\Domain\Events\AssetUnmapped;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Assets\Domain\Models\MarketingAssetRelationship;

/**
 * Creates or updates an explicit M2M relationship between a marketing asset
 * and any ECOS entity (product, brand, sales channel, etc.).
 */
final class MapAssetAction
{
    public function execute(
        string $assetId,
        string $relatedType,
        string $relatedId,
        string $actorId,
        int $confidence = 100,
        bool $isAutoSuggested = false,
    ): MarketingAssetRelationship {
        $asset = MarketingAsset::findOrFail($assetId);

        $relationship = MarketingAssetRelationship::updateOrCreate(
            [
                'marketing_asset_id' => $asset->id,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
            ],
            [
                'mapped_by' => $actorId,
                'mapped_at' => now(),
                'confidence' => $confidence,
                'is_auto_suggested' => $isAutoSuggested,
                'accepted_at' => $isAutoSuggested ? null : now(),
                'accepted_by' => $isAutoSuggested ? null : $actorId,
                'rejected_at' => null,
                'rejected_by' => null,
            ],
        );

        if (! $isAutoSuggested) {
            event(new AssetMapped(
                assetId: $asset->id,
                relatedType: $relatedType,
                relatedId: $relatedId,
                actorId: $actorId,
                confidence: $confidence,
                connectorType: $asset->connector_type ?? '',
            ));
        }

        return $relationship;
    }

    public function accept(string $relationshipId, string $actorId): MarketingAssetRelationship
    {
        $rel = MarketingAssetRelationship::findOrFail($relationshipId);

        $rel->update([
            'accepted_at' => now(),
            'accepted_by' => $actorId,
            'rejected_at' => null,
            'rejected_by' => null,
        ]);

        $asset = MarketingAsset::find($rel->marketing_asset_id);

        event(new AssetMapped(
            assetId: $rel->marketing_asset_id,
            relatedType: $rel->related_type,
            relatedId: $rel->related_id,
            actorId: $actorId,
            confidence: $rel->confidence ?? 100,
            connectorType: $asset?->connector_type ?? '',
        ));

        return $rel->fresh() ?? $rel;
    }

    public function reject(string $relationshipId, string $actorId): MarketingAssetRelationship
    {
        $rel = MarketingAssetRelationship::findOrFail($relationshipId);

        $rel->update([
            'rejected_at' => now(),
            'rejected_by' => $actorId,
            'accepted_at' => null,
            'accepted_by' => null,
        ]);

        event(new AssetUnmapped(
            assetId: $rel->marketing_asset_id,
            relatedType: $rel->related_type,
            relatedId: $rel->related_id,
            actorId: $actorId,
            reason: 'rejected',
        ));

        return $rel->fresh() ?? $rel;
    }
}
