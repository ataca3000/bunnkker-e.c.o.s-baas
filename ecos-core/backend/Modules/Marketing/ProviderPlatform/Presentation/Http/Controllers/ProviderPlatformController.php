<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderCapabilityEngine;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderMetricsCollector;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderRegistry;

final class ProviderPlatformController extends Controller
{
    public function __construct(
        private readonly ProviderRegistry $registry,
        private readonly ProviderCapabilityEngine $capabilities,
        private readonly ProviderMetricsCollector $metrics,
    ) {}

    /**
     * GET /marketing/providers
     * Lists all registered providers with their capabilities and type.
     */
    public function index(Request $request): JsonResponse
    {
        $capability = $request->query('capability');

        $definitions = $capability !== null
            ? $this->registry->findByCapability((string) $capability)
            : $this->registry->all();

        return response()->json([
            'data' => array_map(
                fn ($def) => [
                    'key' => $def->providerKey,
                    'display_name' => $def->displayName,
                    'provider_type' => $def->providerType,
                    'version' => $def->version,
                    'capabilities' => $def->capabilities,
                    'documentation_url' => $def->documentationUrl,
                ],
                $definitions,
            ),
            'meta' => [
                'total' => count($definitions),
            ],
        ]);
    }

    /**
     * GET /marketing/providers/{provider}/metrics
     * Returns the event and activity metrics for a provider (scoped to the company).
     */
    public function metrics(Request $request, string $provider): JsonResponse
    {
        $companyId = (string) $request->user()->company_id;
        $days = (int) ($request->query('days', 7));

        $snapshot = $this->metrics->getMetrics($companyId, $provider);
        $history = $this->metrics->getEventCounts($companyId, $provider, $days);

        return response()->json([
            'provider' => $provider,
            'period_days' => $days,
            'counters' => $snapshot,
            'event_counts' => $history,
        ]);
    }
}
