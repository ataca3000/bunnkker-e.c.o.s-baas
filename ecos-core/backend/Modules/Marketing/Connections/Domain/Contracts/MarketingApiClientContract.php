<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Contracts;

/**
 * Generic HTTP API client abstraction for marketing platform connectors.
 *
 * Every connector's API client (MetaApiClient, GoogleAdsApiClient, etc.)
 * implements this contract. Methods common to all platforms are defined here;
 * platform-specific methods live on the concrete class.
 */
interface MarketingApiClientContract
{
    /**
     * Build the OAuth authorization URL for this platform.
     *
     * @param  list<string>  $scopes
     */
    public function buildAuthUrl(string $redirectUri, string $state, array $scopes): string;

    /**
     * Exchange an OAuth code for a short-lived access token.
     *
     * @return array<string, mixed>
     */
    public function exchangeCode(string $code, string $redirectUri): array;

    /**
     * Inspect/debug the current token.
     *
     * @return array<string, mixed> Platform-specific token metadata
     */
    public function debugToken(string $accessToken): array;
}
