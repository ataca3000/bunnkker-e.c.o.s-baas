<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Application\Services;

use Illuminate\Support\Str;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\MetaConnector\Domain\Models\MetaWebhook;
use Modules\Marketing\MetaConnector\Domain\Services\MetaApiClient;
use Modules\Marketing\ProviderConfig\Domain\Models\MarketingProviderCredential;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;
use Throwable;

/**
 * Manages Meta webhook subscriptions across all supported object types.
 *
 * Meta webhooks require:
 *  1. An app-level subscription (registers callback_url + verify_token with Meta)
 *  2. Per-page subscription (grants a specific page's events to the app)
 *
 * The verify_token is stored encrypted in meta_webhooks.
 * The shared callback URL is handled by MetaWebhookController::incoming().
 *
 * Supported object types and their typical subscribed fields:
 *   page            → feed, messages, messaging_postbacks
 *   instagram       → story_insights, mentions, comments
 *   leadgen         → leadgen
 *   commerce        → orders
 *   whatsapp_business_account → messages
 *   catalog         → product_feed
 */
final class MetaWebhookService
{
    private const OBJECT_CONFIGS = [
        'page' => [
            'fields' => ['feed', 'messages', 'messaging_postbacks', 'leadgen'],
            'label' => 'Facebook Page',
        ],
        'instagram' => [
            'fields' => ['story_insights', 'mentions', 'comments', 'messages'],
            'label' => 'Instagram Business Account',
        ],
        'leadgen' => [
            'fields' => ['leadgen'],
            'label' => 'Lead Forms',
        ],
        'commerce' => [
            'fields' => ['orders'],
            'label' => 'Commerce',
        ],
        'whatsapp_business_account' => [
            'fields' => ['messages'],
            'label' => 'WhatsApp Business',
        ],
        'catalog' => [
            'fields' => ['product_feed'],
            'label' => 'Product Catalog',
        ],
    ];

    public function __construct(
        private readonly MetaApiClient $apiClient,
        private readonly ProviderEventPublisher $events,
    ) {}

    /**
     * Register all standard webhooks for a connection.
     * Typically called once after OAuth and asset discovery completes.
     *
     * @return list<MetaWebhook>
     */
    public function registerAll(MarketingConnection $connection): array
    {
        $webhooks = [];

        foreach (self::OBJECT_CONFIGS as $objectType => $config) {
            $webhook = $this->register(
                connection: $connection,
                objectType: $objectType,
                objectId: null,
                fields: $config['fields'],
            );

            if ($webhook !== null) {
                $webhooks[] = $webhook;
            }
        }

        return $webhooks;
    }

    /**
     * Register a single webhook subscription.
     * Returns null if already registered and active.
     */
    public function register(
        MarketingConnection $connection,
        string $objectType,
        ?string $objectId,
        array $fields,
    ): ?MetaWebhook {
        $existing = MetaWebhook::where('marketing_connection_id', $connection->id)
            ->where('object_type', $objectType)
            ->where('object_id', $objectId)
            ->first();

        if ($existing !== null && $existing->isActive()) {
            return $existing;
        }

        $verifyToken = Str::random(32);
        $callbackUrl = $this->callbackUrl($objectType);

        try {
            $this->apiClient->subscribeApp(
                object: $objectType,
                fields: $fields,
                callbackUrl: $callbackUrl,
                verifyToken: $verifyToken,
            );

            $webhook = $existing ?? new MetaWebhook;
            $webhook->fill([
                'company_id' => $connection->company_id,
                'marketing_connection_id' => $connection->id,
                'object_type' => $objectType,
                'object_id' => $objectId,
                'callback_url' => $callbackUrl,
                'verify_token' => $verifyToken,
                'subscribed_fields' => $fields,
                'status' => 'pending_verification',
                'retry_count' => 0,
            ]);
            $webhook->save();

            $this->events->publish(
                new \Modules\Marketing\ProviderPlatform\Domain\Events\ProviderWebhookRegistered(
                    companyId: (string) $connection->company_id,
                    provider: 'meta',
                    providerType: 'social_platform',
                    triggeredBy: null,
                    currentStatus: $connection->status->value,
                    previousStatus: null,
                    correlationId: null,
                    requestId: null,
                    environment: (string) config('app.env'),
                    metadata: [
                        'object_type' => $objectType,
                        'object_id' => $objectId,
                        'webhook_id' => $webhook->id,
                        'fields_count' => count($fields),
                    ],
                ),
            );

            return $webhook;
        } catch (Throwable $e) {
            if ($existing !== null) {
                $existing->markFailed($e->getMessage());
            }

            return null;
        }
    }

    /**
     * Remove a webhook subscription.
     */
    public function remove(MetaWebhook $webhook, MarketingConnection $connection): void
    {
        try {
            $this->apiClient->deleteAppSubscription($webhook->object_type);
        } catch (Throwable) {
            // Best-effort: even if Meta API fails, remove from DB
        }

        $this->events->publish(
            new \Modules\Marketing\ProviderPlatform\Domain\Events\ProviderWebhookRemoved(
                companyId: (string) $connection->company_id,
                provider: 'meta',
                providerType: 'social_platform',
                triggeredBy: null,
                currentStatus: $connection->status->value,
                previousStatus: null,
                correlationId: null,
                requestId: null,
                environment: (string) config('app.env'),
                metadata: [
                    'object_type' => $webhook->object_type,
                    'webhook_id' => $webhook->id,
                ],
            ),
        );

        $webhook->delete();
    }

    /**
     * Verify that Meta's challenge matches the stored verify_token.
     * Called from the incoming webhook GET request handler.
     */
    public function verifyChallenge(
        string $objectType,
        string $mode,
        string $challenge,
        string $verifyToken,
    ): ?string {
        if ($mode !== 'subscribe') {
            return null;
        }

        $query = MetaWebhook::where('status', 'pending_verification');

        if ($objectType !== 'any') {
            $query->where('object_type', $objectType);
        }

        $webhook = $query->get()->first(fn ($w) => $w->verify_token === $verifyToken);

        if ($webhook === null) {
            return null;
        }

        $webhook->markVerified();

        return $challenge;
    }

    /**
     * Mark a webhook delivery received (updates last_delivery_at).
     */
    public function recordDelivery(string $objectType): void
    {
        MetaWebhook::where('object_type', $objectType)
            ->where('status', 'active')
            ->update(['last_delivery_at' => now()]);
    }

    /**
     * Re-register a failed or inactive webhook.
     */
    public function reRegister(MetaWebhook $webhook, MarketingConnection $connection): ?MetaWebhook
    {
        return $this->register(
            connection: $connection,
            objectType: $webhook->object_type,
            objectId: $webhook->object_id,
            fields: $webhook->subscribed_fields ?? [],
        );
    }

    /**
     * Verify the X-Hub-Signature-256 HMAC signature Meta attaches to every
     * webhook delivery.  Tries all active Meta app secrets (multi-tenant).
     *
     * Security note: $rawBody must be the unmodified request body string,
     * not the parsed JSON — use $request->getContent() at the call site.
     */
    public function verifyWebhookSignature(string $rawBody, string $signature): bool
    {
        if (empty($signature) || ! str_starts_with($signature, 'sha256=')) {
            return false;
        }

        $credentials = MarketingProviderCredential::where('provider', 'meta')
            ->whereNotNull('app_secret')
            ->whereIn('status', ['ready', 'connected'])
            ->get();

        foreach ($credentials as $cred) {
            $appSecret = (string) $cred->app_secret;
            if ($appSecret === '') {
                continue;
            }
            $expected = 'sha256='.hash_hmac('sha256', $rawBody, $appSecret);
            if (hash_equals($expected, $signature)) {
                return true;
            }
        }

        return false;
    }

    /**
     * List all webhooks for a connection.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, MetaWebhook>
     */
    public function listForConnection(MarketingConnection $connection)
    {
        return MetaWebhook::where('marketing_connection_id', $connection->id)
            ->orderBy('object_type')
            ->get();
    }

    /**
     * Build the canonical callback URL for a given object type.
     */
    private function callbackUrl(string $objectType): string
    {
        $base = rtrim((string) config('app.url'), '/');

        return "{$base}/api/marketing/meta/webhooks/incoming/{$objectType}";
    }
}
