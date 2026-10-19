<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Illuminate\Http\Request;
use Modules\CustomerEngagement\Application\Services\ChannelProviderService;
use Modules\CustomerEngagement\Application\Services\WebhookIngestService;
use Modules\CustomerEngagement\Domain\Models\ChannelProvider;
use RuntimeException;

class IngestInboundMessageAction
{
    public function __construct(
        private readonly ChannelProviderService $providerService,
        private readonly WebhookIngestService $ingestService,
    ) {}

    public function execute(ChannelProvider $config, Request $request): void
    {
        if (! $config->webhook_secret || ! $this->providerService->makeProvider($config)->validateWebhook($request, $config->webhook_secret)) {
            throw new RuntimeException('Invalid webhook signature');
        }

        $payload = $request->all();
        $provider = $this->providerService->makeProvider($config);
        $events = $provider->parseInboundWebhook($payload);

        if (! empty($events)) {
            $this->ingestService->processBatch($config->channel, $events, $config->company_id);
        }
    }
}
