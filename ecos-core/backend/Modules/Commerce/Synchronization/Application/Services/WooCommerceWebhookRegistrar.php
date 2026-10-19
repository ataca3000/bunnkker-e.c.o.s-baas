<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Services;

use Illuminate\Support\Facades\Http;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Throwable;

final class WooCommerceWebhookRegistrar
{
    private const TOPICS = [
        'order.created' => 'external_webhook_order_created_id',
        'order.updated' => 'external_webhook_order_updated_id',
    ];

    public function registerOrderWebhooks(Channel $channel): void
    {
        $credential = $channel->credential;

        if ($credential === null) {
            return;
        }

        $deliveryUrl = rtrim(config('app.url'), '/')
            .'/api/webhooks/woocommerce/'
            .$channel->id
            .'/orders';

        foreach (self::TOPICS as $topic => $idColumn) {
            if ($channel->$idColumn !== null) {
                continue;
            }

            $this->registerWebhook($channel, $credential->consumer_key, $credential->consumer_secret, $topic, $deliveryUrl, $idColumn);
        }
    }

    private function registerWebhook(
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
}
