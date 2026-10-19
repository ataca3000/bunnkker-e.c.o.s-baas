<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Application\Actions;

use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Connections\Domain\Models\MarketingAuditLog;
use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiative;

/**
 * Assign one or more Campaigns to a Marketing Initiative.
 *
 * A Campaign can belong to at most one Initiative at a time.
 * Assigning a Campaign that already belongs to a different Initiative
 * moves it to this Initiative.
 */
final class AssignCampaignsToInitiativeAction
{
    /**
     * @param  list<string>  $campaignIds
     * @return array{assigned: int, already_assigned: int}
     */
    public function execute(
        MarketingInitiative $initiative,
        array $campaignIds,
        ?string $actorId = null,
    ): array {
        $campaigns = Campaign::whereIn('id', $campaignIds)->get();

        $assigned = 0;
        $alreadyAssigned = 0;

        foreach ($campaigns as $campaign) {
            if ((string) $campaign->marketing_initiative_id === (string) $initiative->id) {
                $alreadyAssigned++;

                continue;
            }

            $campaign->update(['marketing_initiative_id' => $initiative->id]);

            MarketingAuditLog::record(
                entityType: 'campaign',
                entityId: $campaign->id,
                action: 'assigned_to_initiative',
                actorId: $actorId,
                after: ['initiative_id' => $initiative->id, 'initiative_name' => $initiative->name],
            );

            $assigned++;
        }

        return [
            'assigned' => $assigned,
            'already_assigned' => $alreadyAssigned,
        ];
    }
}
