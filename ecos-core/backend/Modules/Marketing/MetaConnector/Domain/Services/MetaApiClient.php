<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Domain\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Modules\Marketing\Connections\Domain\Contracts\MarketingApiClientContract;
use RuntimeException;

/**
 * Low-level Meta Graph API HTTP client.
 *
 * Implements MarketingApiClientContract so the core OAuth orchestrator
 * can treat all platform clients uniformly.
 *
 * Stateless: every call receives the access_token explicitly.
 */
final class MetaApiClient implements MarketingApiClientContract
{
    private const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

    private const OAUTH_BASE = 'https://www.facebook.com/v21.0/dialog/oauth';

    private const TOKEN_URL = 'https://graph.facebook.com/v21.0/oauth/access_token';

    private const MAX_RETRIES = 3;

    private const TIMEOUT = 30;

    private const PAGE_LIMIT = 200;

    public function __construct(
        private readonly string $appId,
        private readonly string $appSecret,
    ) {}

    // ── OAuth ─────────────────────────────────────────────────────────────────

    /**
     * Generate an OAuth authorization URL.
     *
     * @param  list<string>  $scopes
     */
    public function buildAuthUrl(string $redirectUri, string $state, array $scopes): string
    {
        return self::OAUTH_BASE.'?'.http_build_query([
            'client_id' => $this->appId,
            'redirect_uri' => $redirectUri,
            'state' => $state,
            'scope' => implode(',', $scopes),
            'response_type' => 'code',
        ]);
    }

    /**
     * Exchange an auth code for tokens.
     *
     * @return array{access_token: string, token_type: string, expires_in: int|null}
     */
    public function exchangeCode(string $code, string $redirectUri): array
    {
        $response = $this->retryGet(self::TOKEN_URL, [
            'client_id' => $this->appId,
            'client_secret' => $this->appSecret,
            'code' => $code,
            'redirect_uri' => $redirectUri,
        ], 'token exchange');

        return $response->json();
    }

    /**
     * Extend a short-lived token to a long-lived token (60-day).
     *
     * @return array{access_token: string, token_type: string, expires_in: int}
     */
    public function extendToken(string $shortLivedToken): array
    {
        $response = $this->retryGet(self::TOKEN_URL, [
            'grant_type' => 'fb_exchange_token',
            'client_id' => $this->appId,
            'client_secret' => $this->appSecret,
            'fb_exchange_token' => $shortLivedToken,
        ], 'token extension');

        return $response->json();
    }

    /**
     * Inspect an access token to get permissions and validity.
     */
    public function debugToken(string $userToken): array
    {
        $appToken = $this->appId.'|'.$this->appSecret;
        $response = $this->retryGet(self::GRAPH_BASE.'/debug_token', [
            'input_token' => $userToken,
            'access_token' => $appToken,
        ], 'debug_token');

        return $response->json('data', []);
    }

    // ── Business Manager ──────────────────────────────────────────────────────

    /** @return array{data: list<array{id: string, name: string}>} */
    public function getBusinessManagers(string $accessToken): array
    {
        $response = $this->retryGet(self::GRAPH_BASE.'/me/businesses', [
            'access_token' => $accessToken,
            'fields' => 'id,name,link,primary_page,timezone_id,created_time,verification_status,owned_pages',
            'limit' => self::PAGE_LIMIT,
        ], 'businesses');

        return $response->json();
    }

    public function getAdAccountsForBusiness(string $businessId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$businessId}/owned_ad_accounts", [
            'access_token' => $accessToken,
            'fields' => 'id,name,account_id,account_status,currency,timezone_name,business,created_time',
        ]);
    }

    public function getPagesForBusiness(string $businessId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$businessId}/owned_pages", [
            'access_token' => $accessToken,
            'fields' => 'id,name,category,fan_count,verification_status,link,created_time',
        ]);
    }

    public function getInstagramAccountsForBusiness(string $businessId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$businessId}/instagram_accounts", [
            'access_token' => $accessToken,
            'fields' => 'id,name,username,profile_pic,followers_count,is_verified',
        ]);
    }

    public function getWhatsAppAccountsForBusiness(string $businessId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$businessId}/whatsapp_business_accounts", [
            'access_token' => $accessToken,
            'fields' => 'id,name,currency,timezone_id,message_template_namespace',
        ]);
    }

    public function getPixelsForBusiness(string $businessId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$businessId}/owned_pixels", [
            'access_token' => $accessToken,
            'fields' => 'id,name,code,creation_time,last_fired_time,is_unavailable',
        ]);
    }

    public function getCatalogsForBusiness(string $businessId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$businessId}/owned_product_catalogs", [
            'access_token' => $accessToken,
            'fields' => 'id,name,product_count,vertical,created_time',
        ]);
    }

    public function getDomainsForBusiness(string $businessId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$businessId}/owned_domains", [
            'access_token' => $accessToken,
            'fields' => 'id,name,created_time',
        ]);
    }

    public function getDatasetsForBusiness(string $businessId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$businessId}/datasets", [
            'access_token' => $accessToken,
            'fields' => 'id,name,event_stats,created_time',
        ]);
    }

    public function getAppsForBusiness(string $businessId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$businessId}/owned_apps", [
            'access_token' => $accessToken,
            'fields' => 'id,name,category,created_time',
        ]);
    }

    public function getProductsForCatalog(string $catalogId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$catalogId}/products", [
            'access_token' => $accessToken,
            'fields' => 'id,name,price,currency,availability,condition,url,image_url,brand,category',
        ]);
    }

    public function getProductSetsForCatalog(string $catalogId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$catalogId}/product_sets", [
            'access_token' => $accessToken,
            'fields' => 'id,name,product_count,filter',
        ]);
    }

    // ── Campaign Discovery ────────────────────────────────────────────────────

    /**
     * Get all campaigns for an ad account.
     *
     * @param  array<string, mixed>  $extraParams
     * @return array{data: list<array<string, mixed>>}
     */
    public function getCampaignsForAdAccount(string $adAccountId, string $accessToken, array $extraParams = []): array
    {
        $response = $this->retryGet(self::GRAPH_BASE."/{$adAccountId}/campaigns", array_merge([
            'access_token' => $accessToken,
            'fields' => 'id,name,status,effective_status,objective,buying_type,bid_strategy,daily_budget,lifetime_budget,budget_remaining,special_ad_categories,start_time,stop_time,created_time,updated_time,account_id',
            'limit' => self::PAGE_LIMIT,
        ], $extraParams), 'campaigns');

        return $response->json();
    }

    /** @return list<array<string, mixed>> */
    public function getAdSetsForCampaign(string $campaignId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$campaignId}/adsets", [
            'access_token' => $accessToken,
            'fields' => 'id,name,status,effective_status,daily_budget,lifetime_budget,bid_amount,bid_strategy,optimization_goal,billing_event,targeting,schedule,start_time,end_time,campaign_id,created_time,updated_time',
        ]);
    }

    /** @return list<array<string, mixed>> */
    public function getAdsForAdSet(string $adSetId, string $accessToken): array
    {
        return $this->paginate(self::GRAPH_BASE."/{$adSetId}/ads", [
            'access_token' => $accessToken,
            'fields' => 'id,name,status,effective_status,creative,tracking_specs,adset_id,campaign_id,created_time,updated_time',
        ]);
    }

    /**
     * Fetch insights for any level (campaign / adset / ad).
     *
     * Uses cursor-based pagination so large date ranges (e.g. 365-day backfill)
     * are fully retrieved rather than silently truncated at one page.
     *
     * @return list<array<string, mixed>>
     */
    public function getInsights(
        string $entityId,
        string $accessToken,
        string $datePreset = 'last_30d',
        ?string $dateStart = null,
        ?string $dateStop = null,
        string $level = 'campaign',
    ): array {
        $params = [
            'access_token' => $accessToken,
            'fields' => implode(',', [
                // Delivery
                'spend', 'reach', 'impressions', 'frequency',
                // Efficiency
                'cpm', 'cpc', 'ctr', 'unique_ctr', 'unique_clicks',
                // Traffic
                'clicks', 'outbound_clicks', 'landing_page_views',
                'video_p100_watched_actions',
                // Conversion signals
                'actions', 'action_values',
                // Cost breakdowns
                'cost_per_action_type',
                // Return metrics
                'website_purchase_roas', 'purchase_roas',
                // Date
                'date_start', 'date_stop',
            ]),
            'time_increment' => 1,
        ];

        if ($dateStart !== null && $dateStop !== null) {
            $params['time_range'] = json_encode(['since' => $dateStart, 'until' => $dateStop]);
        } else {
            $params['date_preset'] = $datePreset;
        }

        return $this->paginate(self::GRAPH_BASE."/{$entityId}/insights", $params);
    }

    /** @return list<array<string, mixed>> */
    public function getAdCreatives(string $adId, string $accessToken): array
    {
        $response = $this->retryGet(self::GRAPH_BASE."/{$adId}/adcreatives", [
            'access_token' => $accessToken,
            'fields' => 'id,name,title,body,call_to_action_type,object_story_spec,image_url,image_hash,video_id,thumbnail_url,link_url,asset_feed_spec',
            'limit' => 20,
        ], 'adcreatives');

        return $response->json('data', []);
    }

    // ── Health check ──────────────────────────────────────────────────────────

    public function getMe(string $accessToken): array
    {
        $response = $this->retryGet(self::GRAPH_BASE.'/me', [
            'access_token' => $accessToken,
            'fields' => 'id,name',
        ], 'me');

        return $response->json();
    }

    // ── Webhook Subscriptions ─────────────────────────────────────────────────

    /**
     * Subscribe the app to a real-time update object (app-level subscription).
     * Must be called once per object type (page, instagram_business_account, etc.).
     *
     * Uses the app access token: app_id|app_secret.
     *
     * @param  list<string>  $fields
     * @return array{success: bool}
     */
    public function subscribeApp(
        string $object,
        array $fields,
        string $callbackUrl,
        string $verifyToken,
    ): array {
        $appToken = $this->appId.'|'.$this->appSecret;

        $response = $this->retryPost(
            url: self::GRAPH_BASE."/{$this->appId}/subscriptions",
            params: [
                'object' => $object,
                'callback_url' => $callbackUrl,
                'fields' => implode(',', $fields),
                'verify_token' => $verifyToken,
                'access_token' => $appToken,
            ],
            context: "subscriptions/{$object}",
        );

        return $response->json();
    }

    /**
     * Get all current app-level webhook subscriptions.
     *
     * @return list<array<string, mixed>>
     */
    public function getAppSubscriptions(): array
    {
        $appToken = $this->appId.'|'.$this->appSecret;

        $response = $this->retryGet(
            url: self::GRAPH_BASE."/{$this->appId}/subscriptions",
            params: ['access_token' => $appToken],
            context: 'app_subscriptions',
        );

        return $response->json('data', []);
    }

    /**
     * Delete an app-level subscription for a given object type.
     */
    public function deleteAppSubscription(string $object): void
    {
        $appToken = $this->appId.'|'.$this->appSecret;

        Http::timeout(self::TIMEOUT)->delete(self::GRAPH_BASE."/{$this->appId}/subscriptions", [
            'object' => $object,
            'access_token' => $appToken,
        ]);
    }

    /**
     * Subscribe a Page to receive webhook events through this app.
     * Requires a page access token.
     *
     * @param  list<string>  $subscribedFields
     */
    public function subscribePage(
        string $pageId,
        array $subscribedFields,
        string $pageAccessToken,
    ): void {
        $this->retryPost(
            url: self::GRAPH_BASE."/{$pageId}/subscribed_apps",
            params: [
                'subscribed_fields' => implode(',', $subscribedFields),
                'access_token' => $pageAccessToken,
            ],
            context: "page/{$pageId}/subscribed_apps",
        );
    }

    /**
     * Get page access token from the user token.
     */
    public function getPageAccessToken(string $pageId, string $userAccessToken): string
    {
        $response = $this->retryGet(
            url: self::GRAPH_BASE."/{$pageId}",
            params: [
                'access_token' => $userAccessToken,
                'fields' => 'access_token',
            ],
            context: "page/{$pageId}/access_token",
        );

        return (string) ($response->json('access_token') ?? $userAccessToken);
    }

    /**
     * Unsubscribe a Page from webhook delivery.
     */
    public function unsubscribePage(string $pageId, string $pageAccessToken): void
    {
        Http::timeout(self::TIMEOUT)->delete(self::GRAPH_BASE."/{$pageId}/subscribed_apps", [
            'access_token' => $pageAccessToken,
        ]);
    }

    // ── Token introspection ───────────────────────────────────────────────────

    /**
     * Check whether an access token is still valid (lightweight call).
     *
     * @return array{is_valid: bool, expires_at: int|null, scopes: list<string>}
     */
    public function inspectToken(string $accessToken): array
    {
        $data = $this->debugToken($accessToken);

        return [
            'is_valid' => (bool) ($data['is_valid'] ?? false),
            'expires_at' => $data['expires_at'] ?? null,
            'scopes' => $data['scopes'] ?? [],
        ];
    }

    // ── Pagination ────────────────────────────────────────────────────────────

    /**
     * Follow cursor-based pagination and collect all items across pages.
     *
     * @return list<array<string, mixed>>
     */
    public function paginate(string $url, array $params): array
    {
        $all = [];
        $params['limit'] = $params['limit'] ?? self::PAGE_LIMIT;

        do {
            $response = $this->retryGet($url, $params, 'paginate');
            $data = $response->json('data', []);
            $all = array_merge($all, $data);

            $nextUrl = $response->json('paging.next');
            if ($nextUrl) {
                $url = $nextUrl;
                $params = []; // next URL already has all params encoded
            }
        } while ($nextUrl !== null && count($data) > 0);

        return $all;
    }

    // ── Rate limit helpers ────────────────────────────────────────────────────

    /**
     * Extract the app usage from the X-App-Usage response header.
     *
     * @return array{call_count: int, total_cputime: int, total_time: int}
     */
    public function parseRateLimitHeader(Response $response): array
    {
        $raw = $response->header('X-App-Usage');
        if (empty($raw)) {
            return ['call_count' => 0, 'total_cputime' => 0, 'total_time' => 0];
        }

        return json_decode($raw, true) ?: ['call_count' => 0, 'total_cputime' => 0, 'total_time' => 0];
    }

    // ── Private ───────────────────────────────────────────────────────────────

    /**
     * GET with retry + rate-limit back-off.
     */
    private function retryGet(string $url, array $params, string $context): Response
    {
        return $this->withRetry(
            fn () => Http::timeout(self::TIMEOUT)->get($url, $params),
            $context,
        );
    }

    /**
     * POST with retry + rate-limit back-off.
     */
    private function retryPost(string $url, array $params, string $context): Response
    {
        return $this->withRetry(
            fn () => Http::timeout(self::TIMEOUT)->post($url, $params),
            $context,
        );
    }

    /**
     * Execute a callable with exponential back-off on 429 and 5xx responses.
     */
    private function withRetry(callable $fn, string $context): Response
    {
        $attempt = 0;
        $response = null;

        do {
            if ($attempt > 0) {
                $delay = min(60, 2 ** $attempt);
                Log::info("MetaApiClient: retrying [{$context}] in {$delay}s (attempt {$attempt})");
                sleep($delay);
            }

            /** @var Response $response */
            $response = $fn();
            $attempt++;

            $shouldRetry = ($response->status() === 429 || $response->serverError())
                && $attempt < self::MAX_RETRIES;

        } while ($shouldRetry);

        $this->assertSuccess($response, $context);

        return $response;
    }

    private function assertSuccess(Response $response, string $context): void
    {
        if (! $response->successful()) {
            $error = $response->json('error.message', 'Unknown error');
            $code = $response->json('error.code', 0);
            throw new RuntimeException(
                "Meta API [{$context}] failed (code {$code}): {$error}",
            );
        }
    }
}
