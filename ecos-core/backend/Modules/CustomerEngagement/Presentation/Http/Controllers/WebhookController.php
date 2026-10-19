<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Actions\IngestInboundMessageAction;
use Modules\CustomerEngagement\Application\Services\ChannelProviderService;
use Modules\CustomerEngagement\Domain\Models\ChannelProvider;
use Throwable;

class WebhookController extends Controller
{
    public function __construct(
        private readonly ChannelProviderService $providerService,
        private readonly IngestInboundMessageAction $ingestAction,
    ) {}

    /**
     * GET — provider webhook verification challenge.
     */
    public function verify(Request $request, string $channelProviderId): mixed
    {
        $config = ChannelProvider::findOrFail($channelProviderId);
        $provider = $this->providerService->makeProvider($config);
        $verifyToken = $config->getCredential('verify_token') ?? config('app.key');

        $challenge = $provider->handleVerificationChallenge($request, $verifyToken);

        return $challenge ? response($challenge, 200)->header('Content-Type', 'text/plain') : response('Forbidden', 403);
    }

    /**
     * POST — receive inbound messages and status updates.
     */
    public function receive(Request $request, string $channelProviderId): JsonResponse
    {
        $config = ChannelProvider::findOrFail($channelProviderId);

        try {
            $this->ingestAction->execute($config, $request);
        } catch (Throwable $e) {
            // Always return 200 to provider — never let them retry flood
            report($e);
        }

        return response()->json(['ok' => true]);
    }
}
