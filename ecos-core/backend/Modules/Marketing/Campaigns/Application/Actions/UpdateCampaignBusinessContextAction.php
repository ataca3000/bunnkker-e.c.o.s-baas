<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Application\Actions;

use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Domain\Models\CampaignBusinessContext;
use Modules\Marketing\Connections\Domain\Models\MarketingAuditLog;

/**
 * Create or update the Business Context for a Campaign.
 *
 * Business Context fields belong ONLY to ECOS.
 * They are NEVER touched by provider synchronization.
 */
final class UpdateCampaignBusinessContextAction
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function execute(Campaign $campaign, array $data, ?string $actorId = null): CampaignBusinessContext
    {
        $before = $campaign->businessContext?->toArray() ?? [];

        $context = CampaignBusinessContext::updateOrCreate(
            ['marketing_campaign_id' => $campaign->id],
            array_filter([
                'company_id' => $data['company_id'] ?? null,
                'brand_id' => $data['brand_id'] ?? null,
                'channel_id' => $data['channel_id'] ?? null,
                'cost_center' => $data['cost_center'] ?? null,
                'marketing_team' => $data['marketing_team'] ?? null,
                'marketing_owner_id' => $data['marketing_owner_id'] ?? null,
                'business_unit' => $data['business_unit'] ?? null,
                'season' => $data['season'] ?? null,
                'custom_season' => $data['custom_season'] ?? null,
                'business_goal' => $data['business_goal'] ?? null,
                'internal_status' => $data['internal_status'] ?? null,
                'internal_priority' => $data['internal_priority'] ?? null,
                'internal_notes' => $data['internal_notes'] ?? null,
                'internal_tags' => $data['internal_tags'] ?? null,
                'updated_by' => $actorId,
            ], fn ($v) => $v !== null) + [
                'created_by' => $actorId ?? $context->created_by ?? null,
            ],
        );

        MarketingAuditLog::record(
            entityType: 'campaign',
            entityId: $campaign->id,
            action: 'business_context_updated',
            actorId: $actorId,
            before: $before,
            after: $context->toArray(),
        );

        return $context->fresh() ?? $context;
    }
}
