<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Application\Services;

use Modules\Marketing\Assets\Domain\Enums\AssetType;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Campaigns\Domain\Contracts\CampaignConnectorContract;
use Modules\Marketing\Connections\Application\Abstracts\AbstractMarketingConnector;
use Modules\Marketing\Connections\Domain\Enums\ConnectionStatus;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\MetaConnector\Domain\Services\MetaApiClient;

/**
 * Meta platform connector — first connector in the Marketing OS.
 *
 * Extends AbstractMarketingConnector for shared behaviour (safeDiscover,
 * checkConnectorHealth defaults, checkAssetHealth defaults).
 * Override only what is Meta-specific here.
 *
 * Registers itself in ConnectorRegistry via MetaConnectorServiceProvider::boot().
 * The core Marketing Domain never references this class directly.
 */
final class MetaConnector extends AbstractMarketingConnector implements CampaignConnectorContract
{
    public function __construct(
        private readonly MetaApiClient $apiClient,
        private readonly MetaOAuthService $oauthService,
        private readonly string $redirectUri,
    ) {}

    // ── Identity ──────────────────────────────────────────────────────────────

    public function getType(): string
    {
        return 'meta';
    }

    public function getDisplayName(): string
    {
        return 'Meta (Facebook & Instagram)';
    }

    public function getProviderMetadata(): array
    {
        return [
            'name' => $this->getDisplayName(),
            'logo_url' => null,
            'documentation_url' => 'https://developers.facebook.com/docs/',
            'api_version' => 'v21.0',
            'description' => 'Connect Meta Business Manager to sync Ad Accounts, Pages, Pixels, Catalogs, and more.',
        ];
    }

    public function getSupportedAssetTypes(): array
    {
        return [
            AssetType::BusinessAccount->value,
            AssetType::AdAccount->value,
            AssetType::Page->value,
            AssetType::SocialAccount->value,
            AssetType::Pixel->value,
            AssetType::Catalog->value,
            AssetType::Product->value,
            AssetType::ProductSet->value,
            AssetType::Domain->value,
            AssetType::Dataset->value,
            AssetType::App->value,
        ];
    }

    // ── Authentication ────────────────────────────────────────────────────────

    public function generateAuthUrl(array $params = []): string
    {
        $companyId = $params['company_id'] ?? '';
        ['url' => $url] = $this->oauthService->buildAuthUrl($companyId);

        return $url;
    }

    public function exchangeCodeForToken(string $code, string $redirectUri): array
    {
        $tokenData = $this->apiClient->exchangeCode($code, $redirectUri);
        $extended = $this->apiClient->extendToken($tokenData['access_token']);

        return [
            'access_token' => $extended['access_token'],
            'refresh_token' => null,
            'expires_in' => $extended['expires_in'] ?? null,
            'scopes' => [],
        ];
    }

    public function refreshToken(MarketingConnection $connection): MarketingConnection
    {
        // Meta long-lived tokens cannot be refreshed — user must reconnect.
        $connection->update(['status' => ConnectionStatus::Expired->value]);

        return $connection->fresh() ?? $connection;
    }

    public function validatePermissions(MarketingConnection $connection): array
    {
        return $this->oauthService->validatePermissions($connection);
    }

    // ── Asset Lifecycle ───────────────────────────────────────────────────────

    public function discoverAssets(MarketingConnection $connection): array
    {
        $token = $connection->access_token;
        $assets = [];

        $businessData = $this->apiClient->getBusinessManagers($token);

        foreach ($businessData['data'] ?? [] as $bm) {
            $bmId = $bm['id'];

            $descriptor = [
                'asset_type' => AssetType::BusinessAccount->value,
                'external_id' => $bmId,
                'name' => $bm['name'],
                'status' => 'active',
                'metadata' => [
                    'link' => $bm['link'] ?? null,
                    'timezone_id' => $bm['timezone_id'] ?? null,
                    'created_time' => $bm['created_time'] ?? null,
                ],
            ];
            $assets[] = $descriptor;

            // Ad Accounts
            foreach ($this->safeDiscover(fn () => $this->apiClient->getAdAccountsForBusiness($bmId, $token)) as $aa) {
                $d = [
                    'asset_type' => AssetType::AdAccount->value,
                    'external_id' => $aa['id'],
                    'name' => $aa['name'],
                    'status' => ($aa['account_status'] ?? 0) === 1 ? 'active' : 'inactive',
                    'metadata' => [
                        'account_id' => $aa['account_id'] ?? null,
                        'currency' => $aa['currency'] ?? null,
                        'timezone_name' => $aa['timezone_name'] ?? null,
                        'business_id' => $bmId,
                        'created_time' => $aa['created_time'] ?? null,
                    ],
                ];
                $assets[] = $d;
            }

            // Pages
            foreach ($this->safeDiscover(fn () => $this->apiClient->getPagesForBusiness($bmId, $token)) as $page) {
                $d = [
                    'asset_type' => AssetType::Page->value,
                    'external_id' => $page['id'],
                    'name' => $page['name'],
                    'status' => 'active',
                    'metadata' => [
                        'category' => $page['category'] ?? null,
                        'fan_count' => $page['fan_count'] ?? null,
                        'verification_status' => $page['verification_status'] ?? null,
                        'link' => $page['link'] ?? null,
                        'business_id' => $bmId,
                    ],
                ];
                $assets[] = $d;
            }

            // Instagram / Social Accounts
            foreach ($this->safeDiscover(fn () => $this->apiClient->getInstagramAccountsForBusiness($bmId, $token)) as $ig) {
                $d = [
                    'asset_type' => AssetType::SocialAccount->value,
                    'external_id' => $ig['id'],
                    'name' => $ig['name'] ?? $ig['username'] ?? 'Instagram Account',
                    'status' => 'active',
                    'metadata' => [
                        'social_type' => 'instagram',
                        'username' => $ig['username'] ?? null,
                        'profile_pic' => $ig['profile_pic'] ?? null,
                        'followers_count' => $ig['followers_count'] ?? null,
                        'is_verified' => $ig['is_verified'] ?? false,
                        'business_id' => $bmId,
                    ],
                ];
                $assets[] = $d;
            }

            // WhatsApp → SocialAccount with social_type=whatsapp
            foreach ($this->safeDiscover(fn () => $this->apiClient->getWhatsAppAccountsForBusiness($bmId, $token)) as $wa) {
                $d = [
                    'asset_type' => AssetType::SocialAccount->value,
                    'external_id' => $wa['id'],
                    'name' => $wa['name'],
                    'status' => 'active',
                    'metadata' => [
                        'social_type' => 'whatsapp',
                        'currency' => $wa['currency'] ?? null,
                        'timezone_id' => $wa['timezone_id'] ?? null,
                        'business_id' => $bmId,
                    ],
                ];
                $assets[] = $d;
            }

            // Pixels
            foreach ($this->safeDiscover(fn () => $this->apiClient->getPixelsForBusiness($bmId, $token)) as $pixel) {
                $d = [
                    'asset_type' => AssetType::Pixel->value,
                    'external_id' => $pixel['id'],
                    'name' => $pixel['name'],
                    'status' => ($pixel['is_unavailable'] ?? false) ? 'inactive' : 'active',
                    'metadata' => [
                        'code' => $pixel['code'] ?? null,
                        'last_fired_time' => $pixel['last_fired_time'] ?? null,
                        'creation_time' => $pixel['creation_time'] ?? null,
                        'business_id' => $bmId,
                    ],
                ];
                $assets[] = $d;
            }

            // Product Catalogs + nested Products and Product Sets
            foreach ($this->safeDiscover(fn () => $this->apiClient->getCatalogsForBusiness($bmId, $token)) as $catalog) {
                $catalogId = $catalog['id'];

                $d = [
                    'asset_type' => AssetType::Catalog->value,
                    'external_id' => $catalogId,
                    'name' => $catalog['name'],
                    'status' => 'active',
                    'metadata' => [
                        'product_count' => $catalog['product_count'] ?? null,
                        'vertical' => $catalog['vertical'] ?? null,
                        'business_id' => $bmId,
                    ],
                ];
                $assets[] = $d;

                // Products within this catalog
                foreach ($this->safeDiscover(fn () => $this->apiClient->getProductsForCatalog($catalogId, $token)) as $product) {
                    $pd = [
                        'asset_type' => AssetType::Product->value,
                        'external_id' => $product['id'],
                        'name' => $product['name'] ?? "Product {$product['id']}",
                        'status' => ($product['availability'] ?? '') === 'in stock' ? 'active' : 'inactive',
                        'metadata' => [
                            'price' => $product['price'] ?? null,
                            'currency' => $product['currency'] ?? null,
                            'brand' => $product['brand'] ?? null,
                            'category' => $product['category'] ?? null,
                            'url' => $product['url'] ?? null,
                            'image_url' => $product['image_url'] ?? null,
                            'catalog_id' => $catalogId,
                            'business_id' => $bmId,
                        ],
                    ];
                    $assets[] = $pd;
                }

                // Product Sets (named collections) within this catalog
                foreach ($this->safeDiscover(fn () => $this->apiClient->getProductSetsForCatalog($catalogId, $token)) as $ps) {
                    $psd = [
                        'asset_type' => AssetType::ProductSet->value,
                        'external_id' => $ps['id'],
                        'name' => $ps['name'],
                        'status' => 'active',
                        'metadata' => [
                            'product_count' => $ps['product_count'] ?? null,
                            'filter' => $ps['filter'] ?? null,
                            'catalog_id' => $catalogId,
                            'business_id' => $bmId,
                        ],
                    ];
                    $assets[] = $psd;
                }
            }

            // Domains
            foreach ($this->safeDiscover(fn () => $this->apiClient->getDomainsForBusiness($bmId, $token)) as $domain) {
                $d = [
                    'asset_type' => AssetType::Domain->value,
                    'external_id' => $domain['id'],
                    'name' => $domain['name'],
                    'status' => 'active',
                    'metadata' => ['business_id' => $bmId],
                ];
                $assets[] = $d;
            }

            // Datasets
            foreach ($this->safeDiscover(fn () => $this->apiClient->getDatasetsForBusiness($bmId, $token)) as $ds) {
                $d = [
                    'asset_type' => AssetType::Dataset->value,
                    'external_id' => $ds['id'],
                    'name' => $ds['name'],
                    'status' => 'active',
                    'metadata' => ['business_id' => $bmId],
                ];
                $assets[] = $d;
            }

            // Apps
            foreach ($this->safeDiscover(fn () => $this->apiClient->getAppsForBusiness($bmId, $token)) as $app) {
                $d = [
                    'asset_type' => AssetType::App->value,
                    'external_id' => $app['id'],
                    'name' => $app['name'],
                    'status' => 'active',
                    'metadata' => [
                        'category' => $app['category'] ?? null,
                        'business_id' => $bmId,
                    ],
                ];
                $assets[] = $d;
            }
        }

        return $assets;
    }

    public function syncAsset(MarketingAsset $asset, MarketingConnection $connection): array
    {
        return [
            'external_id' => $asset->external_id,
            'name' => $asset->name,
            'status' => $asset->status,
            'asset_metadata' => $asset->asset_metadata,
            'last_synced_at' => now()->toIso8601String(),
        ];
    }

    // ── CampaignConnectorContract ──────────────────────────────────────────────

    public function discoverCampaigns(
        string $adAccountId,
        MarketingConnection $connection,
        array $params = [],
    ): array {
        $token = $connection->access_token;
        $response = $this->safeDiscover(fn () => $this->apiClient->getCampaignsForAdAccount($adAccountId, $token, $params),
        );

        return array_map(fn (array $c) => [
            'external_campaign_id' => $c['id'],
            'external_account_id' => $adAccountId,
            'name' => $c['name'] ?? '',
            'status' => $c['status'] ?? 'PAUSED',
            'effective_status' => $c['effective_status'] ?? null,
            'objective' => $c['objective'] ?? null,
            'buying_type' => $c['buying_type'] ?? null,
            'bid_strategy' => $c['bid_strategy'] ?? null,
            'daily_budget' => isset($c['daily_budget']) ? (float) $c['daily_budget'] / 100 : null,
            'lifetime_budget' => isset($c['lifetime_budget']) ? (float) $c['lifetime_budget'] / 100 : null,
            'budget_remaining' => isset($c['budget_remaining']) ? (float) $c['budget_remaining'] / 100 : null,
            'special_ad_categories' => $c['special_ad_categories'] ?? [],
            'start_time' => $c['start_time'] ?? null,
            'stop_time' => $c['stop_time'] ?? null,
            'provider_created_at' => $c['created_time'] ?? null,
            'provider_updated_at' => $c['updated_time'] ?? null,
            'provider_payload' => $c,
        ], $response['data'] ?? []);
    }

    public function discoverAdSets(string $campaignId, MarketingConnection $connection): array
    {
        $token = $connection->access_token;

        return array_map(fn (array $as) => [
            'external_ad_set_id' => $as['id'],
            'external_campaign_id' => $campaignId,
            'name' => $as['name'] ?? '',
            'status' => $as['status'] ?? 'PAUSED',
            'effective_status' => $as['effective_status'] ?? null,
            'daily_budget' => isset($as['daily_budget']) ? (float) $as['daily_budget'] / 100 : null,
            'lifetime_budget' => isset($as['lifetime_budget']) ? (float) $as['lifetime_budget'] / 100 : null,
            'bid_amount' => isset($as['bid_amount']) ? (float) $as['bid_amount'] / 100 : null,
            'bid_strategy' => $as['bid_strategy'] ?? null,
            'optimization_goal' => $as['optimization_goal'] ?? null,
            'billing_event' => $as['billing_event'] ?? null,
            'targeting' => $as['targeting'] ?? null,
            'schedule' => $as['schedule'] ?? null,
            'start_time' => $as['start_time'] ?? null,
            'end_time' => $as['end_time'] ?? null,
            'provider_payload' => $as,
        ], $this->safeDiscover(fn () => $this->apiClient->getAdSetsForCampaign($campaignId, $token)));
    }

    public function discoverAds(string $adSetId, MarketingConnection $connection): array
    {
        $token = $connection->access_token;

        return array_map(fn (array $ad) => [
            'external_ad_id' => $ad['id'],
            'external_ad_set_id' => $adSetId,
            'external_campaign_id' => $ad['campaign_id'] ?? '',
            'name' => $ad['name'] ?? '',
            'status' => $ad['status'] ?? 'PAUSED',
            'effective_status' => $ad['effective_status'] ?? null,
            'creative_id' => $ad['creative']['id'] ?? null,
            'tracking_specs' => $ad['tracking_specs'] ?? null,
            'preview_url' => $ad['preview_url'] ?? null,
            'provider_payload' => $ad,
        ], $this->safeDiscover(fn () => $this->apiClient->getAdsForAdSet($adSetId, $token)));
    }

    public function fetchInsights(
        string $entityId,
        string $level,
        MarketingConnection $connection,
        string $datePreset = 'last_30d',
        ?string $dateStart = null,
        ?string $dateStop = null,
    ): array {
        $token = $connection->access_token;

        return $this->safeDiscover(fn () => $this->apiClient->getInsights($entityId, $token, $datePreset, $dateStart, $dateStop, $level),
        );
    }

    public function discoverCreatives(string $adId, MarketingConnection $connection): array
    {
        $token = $connection->access_token;

        return array_map(fn (array $c) => [
            'external_creative_id' => $c['id'],
            'name' => $c['name'] ?? null,
            'headline' => $c['title'] ?? null,
            'primary_text' => $c['body'] ?? null,
            'call_to_action' => $c['call_to_action_type'] ?? null,
            'image_url' => $c['image_url'] ?? null,
            'image_hash' => $c['image_hash'] ?? null,
            'video_url' => null,
            'video_id' => $c['video_id'] ?? null,
            'thumbnail_url' => $c['thumbnail_url'] ?? null,
            'link_url' => $c['link_url'] ?? null,
            'asset_feed' => $c['asset_feed_spec'] ?? null,
            'provider_payload' => $c,
        ], $this->safeDiscover(fn () => $this->apiClient->getAdCreatives($adId, $token)));
    }
}
