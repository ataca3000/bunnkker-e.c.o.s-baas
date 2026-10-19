<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Contracts;

use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

/**
 * Generic OAuth abstraction for marketing platform connectors.
 *
 * Every connector's OAuth service (MetaOAuthService, GoogleAdsOAuthService, etc.)
 * implements this contract so the core platform can orchestrate the OAuth lifecycle
 * without knowing which platform it is talking to.
 */
interface MarketingOAuthContract
{
    /**
     * Build the platform's OAuth authorization URL.
     *
     * @return array{url: string, state: string}
     */
    public function buildAuthUrl(string $companyId): array;

    /**
     * Handle the OAuth callback: validate state, exchange code, persist connection.
     */
    public function handleCallback(string $code, string $state, string $actorId): MarketingConnection;

    /**
     * Validate permissions on an existing connection and update its status.
     *
     * @return array{valid: bool, granted: list<string>, missing: list<string>}
     */
    public function validatePermissions(MarketingConnection $connection): array;
}
