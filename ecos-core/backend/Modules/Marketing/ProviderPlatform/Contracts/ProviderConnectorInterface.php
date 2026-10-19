<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Contracts;

/**
 * Enterprise Provider Connector Contract (Platform tier).
 *
 * All marketing platform connectors (Meta, Google Ads, TikTok, LinkedIn, etc.)
 * implement this interface.  The platform never imports a specific connector
 * class — all operations go through this contract.
 *
 * This is the platform-level contract.  The lower-level
 * `MarketingConnectorInterface` (in the Connections module) covers OAuth
 * connection and asset sync operations.
 *
 * Capability declarations must use ProviderCapability constants.
 * No hardcoded provider-specific checks anywhere in consumer code.
 */
interface ProviderConnectorInterface
{
    // ── Identity ──────────────────────────────────────────────────────────────

    /** Machine key used throughout the platform (e.g. "meta", "google_ads"). */
    public function getProviderKey(): string;

    /** Human-readable display name for UI. */
    public function getDisplayName(): string;

    /** Provider category: "social_platform", "advertising_platform", etc. */
    public function getProviderType(): string;

    /**
     * API version currently in use.
     * Used by the registry for compatibility checks.
     */
    public function getApiVersion(): string;

    // ── Capabilities ──────────────────────────────────────────────────────────

    /**
     * List of ProviderCapability constants this provider supports.
     *
     * @return list<string> ProviderCapability::* values
     */
    public function getCapabilities(): array;

    /** Whether this provider supports the given capability. */
    public function supports(string $capability): bool;

    // ── Credential status ─────────────────────────────────────────────────────

    /**
     * Current credential/connection status for a company.
     *
     * @return string One of: not_configured, invalid, ready, connected,
     *                token_expired, permission_error, service_unavailable, etc.
     */
    public function status(string $companyId): string;

    // ── Credential lifecycle ──────────────────────────────────────────────────

    /**
     * Validate that stored credentials are still accepted by the provider API.
     *
     * @return array{valid: bool, errors: list<string>}
     */
    public function validate(string $companyId): array;

    /** Run a full health check and return the health report. */
    public function health(string $companyId): array;

    // ── OAuth lifecycle ───────────────────────────────────────────────────────

    /**
     * Begin the OAuth authorization flow.
     * Returns the URL to redirect the user to.
     */
    public function connect(string $companyId, array $params = []): string;

    /**
     * Revoke the OAuth token and disconnect the provider.
     */
    public function disconnect(string $companyId): void;

    /**
     * Attempt to refresh the OAuth access token.
     * Connectors that do not support refresh should mark the connection expired.
     */
    public function refreshToken(string $companyId): void;

    // ── Sync ──────────────────────────────────────────────────────────────────

    /**
     * Trigger asset discovery and sync.
     *
     * @return array{dispatched: bool, job_id: string|null}
     */
    public function sync(string $companyId, array $options = []): array;

    // ── Webhooks ──────────────────────────────────────────────────────────────

    /** Register a webhook subscription with the provider. */
    public function registerWebhook(string $companyId, string $callbackUrl): void;

    /** Remove an existing webhook subscription. */
    public function removeWebhook(string $companyId, string $webhookId): void;
}
