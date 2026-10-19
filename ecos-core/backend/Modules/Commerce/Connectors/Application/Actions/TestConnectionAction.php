<?php

declare(strict_types=1);

namespace Modules\Commerce\Connectors\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Channels\Domain\Contracts\ChannelRepositoryInterface;
use Modules\Commerce\Channels\Domain\Enums\ConnectionStatus;
use Modules\Commerce\Channels\Domain\Exceptions\ChannelNotFoundException;
use Modules\Commerce\Connectors\Application\Services\WooCommerceConnector;
use Modules\Commerce\Synchronization\Application\Services\WebhookManagerService;

final class TestConnectionAction extends BaseAction
{
    public function __construct(
        private readonly ChannelRepositoryInterface $channels,
        private readonly WooCommerceConnector $connector,
        private readonly WebhookManagerService $webhookManager,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $channelId = (string) ($arguments[0] ?? '');
        $channel = $this->channels->findById($channelId);

        if ($channel === null) {
            throw new ChannelNotFoundException($channelId);
        }

        $credential = $channel->credential;

        if ($credential === null) {
            $channel->update(['connection_status' => ConnectionStatus::Error->value]);

            return OperationResult::success(
                $channel->refresh()->load('company'),
                'No credentials configured for this channel.',
            );
        }

        $connected = $this->connector->testConnection(
            $channel->store_url,
            $credential->consumer_key,
            $credential->consumer_secret,
        );

        $status = $connected ? ConnectionStatus::Connected : ConnectionStatus::Error;
        $channel->update(['connection_status' => $status->value]);

        if ($connected) {
            $this->webhookManager->registerAll($channel->refresh());
        }

        $message = $connected
            ? 'Connection successful.'
            : 'Connection failed. Please check your store URL and credentials.';

        return OperationResult::success(
            $channel->refresh()->load('company'),
            $message,
        );
    }
}
