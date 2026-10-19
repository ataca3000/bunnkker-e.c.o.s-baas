<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Application\Actions;

use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Connections\Domain\Models\MarketingAuditLog;
use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiative;

/**
 * Remove a Campaign from a Marketing Initiative.
 *
 * Sets marketing_initiative_id to NULL on the Campaign.
 * The Campaign remains fully functional — only loses its initiative assignment.
 */
final class RemoveCampaignFromInitiativeAction
{
    public function execute(
        MarketingInitiative $initiative,
        Campaign $campaign,
        ?string $actorId = null,
    ): void {
        if ((string) $campaign->marketing_initiative_id !== (string) $initiative->id) {
            return; // Campaign doesn't belong to this initiative; no-op
        }

        $campaign->update(['marketing_initiative_id' => null]);

        MarketingAuditLog::record(
            entityType: 'campaign',
            entityId: $campaign->id,
            action: 'removed_from_initiative',
            actorId: $actorId,
            before: ['initiative_id' => $initiative->id, 'initiative_name' => $initiative->name],
        );
    }
}
