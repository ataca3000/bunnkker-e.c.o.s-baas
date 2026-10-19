<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Marketing\Campaigns\Application\Actions\UpdateCampaignBusinessContextAction;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Presentation\Http\Resources\CampaignResource;

final class CampaignController extends Controller
{
    public function __construct(
        private readonly UpdateCampaignBusinessContextAction $updateContext,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Campaign::query()
            ->with('businessContext')
            ->withCount(['adSets', 'ads']);

        // Filters
        if ($search = $request->query('search')) {
            $query->where('name', 'like', "%{$search}%");
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($objective = $request->query('objective')) {
            $query->where('objective', $objective);
        }
        if ($connectorType = $request->query('connector_type')) {
            $query->where('connector_type', $connectorType);
        }
        if ($connectionId = $request->query('connection_id')) {
            $query->where('marketing_connection_id', $connectionId);
        }
        if ($companyId = $request->query('company_id')) {
            $query->where('company_id', $companyId);
        }
        if ($initiativeId = $request->query('initiative_id')) {
            $query->where('marketing_initiative_id', $initiativeId);
        }
        if ($request->boolean('unassigned')) {
            $query->whereNull('marketing_initiative_id');
        }

        $perPage = min((int) $request->query('per_page', 25), 100);

        return CampaignResource::collection(
            $query->orderBy('created_at', 'desc')->paginate($perPage),
        );
    }

    public function show(Campaign $campaign): CampaignResource
    {
        $campaign->load('businessContext', 'adSets', 'ads', 'creatives');
        $campaign->loadCount(['adSets', 'ads']);

        return new CampaignResource($campaign);
    }

    public function updateBusinessContext(Request $request, Campaign $campaign): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => ['nullable', 'string'],
            'brand_id' => ['nullable', 'string'],
            'channel_id' => ['nullable', 'string'],
            'cost_center' => ['nullable', 'string', 'max:100'],
            'marketing_team' => ['nullable', 'string', 'max:100'],
            'marketing_owner_id' => ['nullable', 'string'],
            'business_unit' => ['nullable', 'string', 'max:100'],
            'season' => ['nullable', 'string'],
            'custom_season' => ['nullable', 'string', 'max:100'],
            'business_goal' => ['nullable', 'string'],
            'internal_status' => ['nullable', 'string', 'max:50'],
            'internal_priority' => ['nullable', 'in:low,medium,high,critical'],
            'internal_notes' => ['nullable', 'string', 'max:2000'],
            'internal_tags' => ['nullable', 'array'],
        ]);

        $context = $this->updateContext->execute(
            campaign: $campaign,
            data: $validated,
            actorId: $request->user()?->id,
        );

        return response()->json([
            'message' => 'Business context updated.',
            'context' => $context->toArray(),
        ]);
    }
}
