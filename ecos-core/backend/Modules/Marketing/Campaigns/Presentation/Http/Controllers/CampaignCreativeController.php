<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Domain\Models\CampaignCreative;
use Modules\Marketing\Campaigns\Presentation\Http\Resources\CampaignCreativeResource;

final class CampaignCreativeController extends Controller
{
    public function index(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $creatives = $campaign->creatives()
            ->when($request->query('type'), fn ($q, $v) => $q->where('creative_type', $v))
            ->when($request->query('has_media'), fn ($q) => $q->where(function ($q2) {
                $q2->whereNotNull('image_url')->orWhereNotNull('video_url');
            }))
            ->orderBy('created_at', 'desc')
            ->paginate((int) $request->query('per_page', 25));

        return CampaignCreativeResource::collection($creatives);
    }

    public function show(Campaign $campaign, CampaignCreative $creative): CampaignCreativeResource
    {
        return new CampaignCreativeResource($creative);
    }
}
