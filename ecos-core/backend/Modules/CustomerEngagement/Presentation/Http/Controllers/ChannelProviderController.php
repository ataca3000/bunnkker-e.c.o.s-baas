<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Services\ChannelProviderService;
use Modules\CustomerEngagement\Domain\Models\ChannelProvider;
use Modules\CustomerEngagement\Presentation\Http\Resources\ChannelProviderResource;

class ChannelProviderController extends Controller
{
    public function __construct(private readonly ChannelProviderService $providerService) {}

    public function index(Request $request): JsonResponse
    {
        $providers = $this->providerService->paginate($request->only(['company_id', 'channel']));

        return response()->json(ChannelProviderResource::collection($providers)->response()->getData(true));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => 'required|uuid',
            'brand_id' => 'nullable|uuid',
            'channel' => 'required|string|in:whatsapp,messenger,instagram_direct',
            'display_name' => 'required|string|max:255',
            'credentials' => 'required|array',
            'webhook_secret' => 'nullable|string',
            'phone_number' => 'nullable|string',
            'business_account_id' => 'nullable|string',
            'page_id' => 'nullable|string',
        ]);

        return response()->json(new ChannelProviderResource($this->providerService->create($data)), 201);
    }

    public function show(ChannelProvider $channelProvider): JsonResponse
    {
        return response()->json(new ChannelProviderResource($channelProvider));
    }

    public function update(Request $request, ChannelProvider $channelProvider): JsonResponse
    {
        $data = $request->validate([
            'display_name' => 'sometimes|string|max:255',
            'credentials' => 'sometimes|array',
            'webhook_secret' => 'nullable|string',
            'phone_number' => 'nullable|string',
            'business_account_id' => 'nullable|string',
            'page_id' => 'nullable|string',
        ]);
        $channelProvider->update($data);

        return response()->json(new ChannelProviderResource($channelProvider->fresh()));
    }

    public function destroy(ChannelProvider $channelProvider): JsonResponse
    {
        $channelProvider->delete();

        return response()->json(null, 204);
    }

    public function activate(ChannelProvider $channelProvider): JsonResponse
    {
        $provider = $this->providerService->activate($channelProvider);

        return response()->json(new ChannelProviderResource($provider));
    }
}
