<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\MetaConnector\Application\Jobs\MetaIncrementalSyncJob;
use Modules\Marketing\MetaConnector\Application\Services\MetaOAuthService;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialService;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;

final class MetaAuthController extends Controller
{
    public function __construct(
        private readonly MetaOAuthService $oauthService,
        private readonly ProviderCredentialService $providerConfig,
    ) {}

    /**
     * Generate a Meta OAuth URL for the frontend to redirect the user to.
     *
     * Returns 422 with reason=not_configured if Meta credentials have not been
     * configured. The frontend must show the Config Wizard before allowing OAuth.
     *
     * GET /marketing/meta/auth/redirect?company_id=xxx
     */
    public function redirect(Request $request): JsonResponse
    {
        $companyId = $request->string('company_id')->toString();

        if (! $this->providerConfig->isConfigured($companyId, 'meta')) {
            return response()->json([
                'error' => 'not_configured',
                'message' => 'Meta is not configured yet. Complete the Meta Configuration Wizard before connecting.',
            ], 422);
        }

        ['url' => $url, 'state' => $state] = $this->oauthService->buildAuthUrl($companyId);

        return response()->json(['url' => $url, 'state' => $state]);
    }

    /**
     * Handle the OAuth callback from Meta.
     *
     * Creates the connection, dispatches asset discovery async, returns immediately.
     * The frontend should poll the connection dashboard for business discovery results.
     *
     * GET /marketing/meta/auth/callback
     */
    public function callback(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string'],
            'state' => ['required', 'string'],
        ]);

        $connection = $this->oauthService->handleCallback(
            code: $request->string('code')->toString(),
            state: $request->string('state')->toString(),
            actorId: (string) $request->user()->id,
        );

        // Dispatch initial full asset discovery as a background job.
        // Full sync on first connect — discovers all asset types (Businesses, Pages,
        // Instagram, Ad Accounts, Pixels, Catalogs, etc.).
        // Do NOT run synchronously — Meta accounts with many assets can take 60-120s.
        MetaIncrementalSyncJob::dispatch($connection->id, (string) $connection->company_id, SyncType::Full);

        return response()->json([
            'message' => 'Meta connection established. Asset discovery has started in the background.',
            'connection' => [
                'id' => $connection->id,
                'label' => $connection->label,
                'status' => $connection->status,
                'connector_type' => $connection->connector_type,
                'connected_at' => $connection->connected_at?->toISOString(),
            ],
        ], 201);
    }

    /**
     * POST /marketing/meta/connections/{connection}/disconnect
     */
    public function disconnect(Request $request, string $connectionId): JsonResponse
    {
        $connection = \Modules\Marketing\Connections\Domain\Models\MarketingConnection::where('id', $connectionId)
            ->where('company_id', (string) $request->user()->company_id)
            ->firstOrFail();

        $this->oauthService->disconnect($connection, (string) $request->user()->id);

        return response()->json(['message' => 'Meta connection disconnected.']);
    }
}
