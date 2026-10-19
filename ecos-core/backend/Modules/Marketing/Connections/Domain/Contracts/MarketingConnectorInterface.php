<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Contracts;

use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Connections\Domain\ValueObjects\ConnectorHealthData;

/**
 * Enterprise Marketing Connector Contract.
 *
 * Every platform connector (Meta, Google Ads, TikTok, Snapchat, LinkedIn, etc.)
 * implements this interface and self-registers in ConnectorRegistry.
 *
 * The Marketing Domain NEVER imports a specific connector class.
 * All platform-specific behaviour lives behind this contract.
 */
interface MarketingConnectorInterface
{
    // ── Identity ──────────────────────────────────────────────────────────────

    /** Returns the connector type string used as the registry key (e.g. 'meta'). */
    public function getType(): string;

    /** Human-readable platform name for UI display. */
    public function getDisplayName(): string;

    /**
     * Provider-level metadata surfaced in the Connector Registry workspace.
     *
     * @return array{
     *   name:              string,
     *   logo_url:          string|null,
     *   documentation_url: string|null,
     *   api_version:       string|null,
     *   description:       string|null,
     * }
     */
    public function getProviderMetadata(): array;

    /**
     * Asset types this connector can discover.
     *
     * @return list<string> AssetType enum values
     */
    public function getSupportedAssetTypes(): array;

    /**
     * Capabilities this connector exposes.
     *
     * @return list<string> e.g. ['oauth', 'asset_discovery', 'health_check', 'sync']
     */
    public function getCapabilities(): array;

    // ── Authentication ────────────────────────────────────────────────────────

    /**
     * Generate the OAuth authorization URL.
     *
     * @param  array<string, string>  $params  Extra context (state, company_id, etc.)
     */
    public function generateAuthUrl(array $params = []): string;

    /**
     * Exchange an OAuth code for access + refresh tokens.
     *
     * @return array{access_token: string, refresh_token: string|null, expires_in: int|null, scopes: list<string>}
     */
    public function exchangeCodeForToken(string $code, string $redirectUri): array;

    /**
     * Attempt to refresh the access token.
     * Connectors that do not support refresh should mark the connection Expired.
     */
    public function refreshToken(MarketingConnection $connection): MarketingConnection;

    /**
     * Validate that the connection still has all required permissions.
     *
     * @return array{valid: bool, granted: list<string>, missing: list<string>}
     */
    public function validatePermissions(MarketingConnection $connection): array;

    // ── Asset Lifecycle ───────────────────────────────────────────────────────

    /**
     * Discover all assets available under this connection.
     * Returns raw descriptors — the caller (RunSyncAction) persists them.
     *
     * @return list<array{
     *   asset_type:  string,
     *   external_id: string,
     *   name:        string,
     *   status:      string,
     *   metadata:    array<string, mixed>
     * }>
     */
    public function discoverAssets(MarketingConnection $connection): array;

    /**
     * Sync (refresh) the metadata for a single already-persisted asset.
     */
    public function syncAsset(MarketingAsset $asset, MarketingConnection $connection): array;

    /**
     * Check the health of a single asset.
     * Returns an AssetHealth enum value string.
     */
    public function checkAssetHealth(MarketingAsset $asset, MarketingConnection $connection): string;

    // ── Connector Health ──────────────────────────────────────────────────────

    /**
     * Check and return the health of the connection itself (token, API, rate limits).
     * This is distinct from individual asset health.
     */
    public function checkConnectorHealth(MarketingConnection $connection): ConnectorHealthData;
}
