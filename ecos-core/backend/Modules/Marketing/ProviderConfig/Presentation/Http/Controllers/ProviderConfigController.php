<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialService;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderHealthMonitor;

/**
 * Manages runtime configuration for marketing platform providers.
 *
 * Security contract:
 *  - App secrets are NEVER returned after save — only `has_app_secret: true|false`.
 *  - All write operations require an authenticated user (auth:sanctum middleware).
 *  - Redirect URIs are validated server-side before acceptance.
 */
final class ProviderConfigController extends Controller
{
    private const SUPPORTED_PROVIDERS = ['meta', 'google_ads', 'tiktok', 'snapchat', 'linkedin', 'x_twitter'];

    public function __construct(
        private readonly ProviderCredentialService $service,
        private readonly ProviderHealthMonitor $health,
    ) {}

    /**
     * GET /marketing/providers/{provider}/config
     * Returns current config status.  Never exposes app_secret.
     */
    public function show(Request $request, string $provider): JsonResponse
    {
        $this->guardProvider($provider);

        return response()->json([
            'data' => $this->service->getStatus($this->companyId($request), $provider),
        ]);
    }

    /**
     * POST /marketing/providers/{provider}/config/validate
     * Validates credentials against the provider API without saving.
     */
    public function validate(Request $request, string $provider): JsonResponse
    {
        $this->guardProvider($provider);

        $request->validate([
            'app_id' => ['required', 'string', 'max:255'],
            'app_secret' => ['required', 'string', 'max:500'],
        ]);

        $result = $this->service->validate(
            provider: $provider,
            appId: $request->string('app_id')->toString(),
            appSecret: $request->string('app_secret')->toString(),
            companyId: $this->companyId($request),
        );

        return response()->json(['data' => $result], $result['valid'] ? 200 : 422);
    }

    /**
     * POST /marketing/providers/{provider}/config
     * Validates credentials and saves if valid.
     */
    public function save(Request $request, string $provider): JsonResponse
    {
        $this->guardProvider($provider);
        $this->guardAdminPermission($request);

        $request->validate([
            'app_id' => ['required', 'string', 'max:255'],
            'app_secret' => ['nullable', 'string', 'max:500'],
            'redirect_uri' => ['nullable', 'url', 'max:500', 'starts_with:https://,http://'],
        ]);

        $companyId = $this->companyId($request);

        $result = $this->service->validateAndSave(
            companyId: $companyId,
            provider: $provider,
            appId: $request->string('app_id')->toString(),
            appSecret: $request->filled('app_secret') ? $request->string('app_secret')->toString() : null,
            redirectUri: $request->string('redirect_uri', '')->toString(),
            actorId: (string) $request->user()->id,
        );

        $this->health->invalidate($companyId, $provider);

        return response()->json([
            'data' => array_merge(
                $result,
                ['config' => $this->service->getStatus($companyId, $provider)],
            ),
        ], $result['saved'] ? 200 : 422);
    }

    /**
     * POST /marketing/providers/{provider}/config/rotate-secret
     * Validates new secret → saves encrypted → invalidates all caches.
     * Previous secret is discarded immediately; no service downtime required.
     */
    public function rotateSecret(Request $request, string $provider): JsonResponse
    {
        $this->guardProvider($provider);
        $this->guardAdminPermission($request);

        $request->validate([
            'app_id' => ['required', 'string', 'max:255'],
            'new_app_secret' => ['required', 'string', 'max:500'],
        ]);

        $companyId = $this->companyId($request);

        $result = $this->service->rotateSecret(
            companyId: $companyId,
            provider: $provider,
            appId: $request->string('app_id')->toString(),
            newAppSecret: $request->string('new_app_secret')->toString(),
            actorId: (string) $request->user()->id,
        );

        if ($result['rotated']) {
            $this->health->invalidate($companyId, $provider);
        }

        return response()->json([
            'data' => array_merge(
                $result,
                $result['rotated'] ? ['config' => $this->service->getStatus($companyId, $provider)] : [],
            ),
        ], $result['rotated'] ? 200 : 422);
    }

    /**
     * GET /marketing/providers/{provider}/health
     * Returns the cached health status (runs checks if cache is cold).
     */
    public function health(Request $request, string $provider): JsonResponse
    {
        $this->guardProvider($provider);

        return response()->json([
            'data' => $this->health->check($this->companyId($request), $provider),
        ]);
    }

    /**
     * DELETE /marketing/providers/{provider}/config
     * Removes configuration and resets status to not_configured.
     */
    public function destroy(Request $request, string $provider): JsonResponse
    {
        $this->guardProvider($provider);
        $this->guardAdminPermission($request);

        $companyId = $this->companyId($request);

        $this->service->clear(
            companyId: $companyId,
            provider: $provider,
            actorId: (string) $request->user()->id,
        );

        $this->health->invalidate($companyId, $provider);

        return response()->json(['data' => ['message' => "Provider [{$provider}] configuration removed."]]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function guardProvider(string $provider): void
    {
        if (! in_array($provider, self::SUPPORTED_PROVIDERS, true)) {
            abort(422, "Provider [{$provider}] is not supported.");
        }
    }

    private function guardAdminPermission(Request $request): void
    {
        if ($request->user() === null) {
            abort(401, 'Unauthenticated.');
        }
    }

    private function companyId(Request $request): ?string
    {
        $id = $request->user()?->company_id;

        return ($id !== null && $id !== '') ? (string) $id : null;
    }
}
