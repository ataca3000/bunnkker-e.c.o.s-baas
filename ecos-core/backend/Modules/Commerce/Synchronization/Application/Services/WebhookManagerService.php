<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Services;

use Illuminate\Support\Facades\Http;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Throwable;

/**
 * Manages the full lifecycle of WooCommerce webhooks for all 7 topics.
 *
 * Delivery URL scheme (production-ready):
 *   orders:    {APP_URL}/api/webhooks/woocommerce/{channel_id}/orders
 *   products:  {APP_URL}/api/webhooks/woocommerce/{channel_id}/products
 *   customers: {APP_URL}/api/webhooks/woocommerce/{channel_id}/customers
 *
 * APP_URL must be a publicly accessible URL in production.
 */
final class WebhookManagerService
{
    /**
     * Maps each WooCommerce topic to the Channel column that stores its webhook ID
     * and the ERP route segment that handles it.
     *
     * @var array<string, array{column: string, route: string}>
     */
    private const TOPICS = [
        'order.created' => ['column' => 'external_webhook_order_created_id',    'route' => 'orders'],
        'order.updated' => ['column' => 'external_webhook_order_updated_id',    'route' => 'orders'],
        'product.created' => ['column' => 'external_webhook_product_created_id',  'route' => 'products'],
        'product.updated' => ['column' => 'external_webhook_product_updated_id',  'route' => 'products'],
        'product.deleted' => ['column' => 'external_webhook_product_deleted_id',  'route' => 'products'],
        'customer.created' => ['column' => 'external_webhook_customer_created_id', 'route' => 'customers'],
        'customer.updated' => ['column' => 'external_webhook_customer_updated_id', 'route' => 'customers'],
    ];

    public function registerAll(Channel $channel): void
    {
        $credential = $channel->credential;

        if ($credential === null) {
            return;
        }

        $baseUrl = rtrim(config('app.url'), '/').'/api/webhooks/woocommerce/'.$channel->id.'/';

        foreach (self::TOPICS as $topic => $config) {
            if ($channel->{$config['column']} !== null) {
                continue;
            }

            $deliveryUrl = $baseUrl.$config['route'];

            $this->register(
                $channel,
                $credential->consumer_key,
                $credential->consumer_secret,
                $topic,
                $deliveryUrl,
                $config['column'],
            );
        }
    }

    public function deregisterAll(Channel $channel): void
    {
        $credential = $channel->credential;

        if ($credential === null) {
            return;
        }

        foreach (self::TOPICS as $config) {
            $webhookId = $channel->{$config['column']};

            if ($webhookId === null) {
                continue;
            }

            $this->deregister(
                $channel,
                $credential->consumer_key,
                $credential->consumer_secret,
                $webhookId,
                $config['column'],
            );
        }
    }

    private function register(
        Channel $channel,
        string $consumerKey,
        string $consumerSecret,
        string $topic,
        string $deliveryUrl,
        string $idColumn,
    ): void {
        try {
            $response = Http::withBasicAuth($consumerKey, $consumerSecret)
                ->timeout(15)
                ->post(
                    rtrim($channel->store_url, '/').'/wp-json/wc/v3/webhooks',
                    [
                        'name' => 'ECOS ERP – '.$topic,
                        'topic' => $topic,
                        'delivery_url' => $deliveryUrl,
                        'secret' => $consumerSecret,
                        'status' => 'active',
                    ],
                );

            if ($response->successful()) {
                $webhookId = (string) ($response->json('id') ?? '');

                if ($webhookId !== '') {
                    $channel->update([$idColumn => $webhookId]);
                }
            }
        } catch (Throwable) {
        }
    }

    private function deregister(
        Channel $channel,
        string $consumerKey,
        string $consumerSecret,
        string $webhookId,
        string $idColumn,
    ): void {
        try {
            Http::withBasicAuth($consumerKey, $consumerSecret)
                ->timeout(15)
                ->delete(rtrim($channel->store_url, '/').'/wp-json/wc/v3/webhooks/'.$webhookId);

            $channel->update([$idColumn => null]);
        } catch (Throwable) {
        }
    }
}
