<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Domain\Models\CampaignAd;
use Modules\Marketing\Campaigns\Domain\Models\CampaignAdSet;
use Modules\Marketing\Campaigns\Presentation\Http\Resources\CampaignAdResource;

final class CampaignAdController extends Controller
{
    public function index(Request $request, Campaign $campaign, CampaignAdSet $adSet): AnonymousResourceCollection
    {
        $ads = $adSet->ads()
            ->with('creative')
            ->orderBy('created_at', 'desc')
            ->paginate((int) $request->query('per_page', 25));

        return CampaignAdResource::collection($ads);
    }

    public function show(Campaign $campaign, CampaignAdSet $adSet, CampaignAd $ad): CampaignAdResource
    {
        return new CampaignAdResource($ad->load('creative'));
    }
}
