<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Domain\Models\CampaignAdSet;
use Modules\Marketing\Campaigns\Presentation\Http\Resources\CampaignAdSetResource;

final class CampaignAdSetController extends Controller
{
    public function index(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $adSets = $campaign->adSets()
            ->withCount('ads')
            ->orderBy('created_at', 'desc')
            ->paginate((int) $request->query('per_page', 25));

        return CampaignAdSetResource::collection($adSets);
    }

    public function show(Campaign $campaign, CampaignAdSet $adSet): CampaignAdSetResource
    {
        return new CampaignAdSetResource($adSet->loadCount('ads'));
    }
}
