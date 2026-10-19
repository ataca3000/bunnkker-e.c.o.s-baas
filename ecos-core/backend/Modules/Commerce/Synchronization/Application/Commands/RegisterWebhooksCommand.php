<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Commands;

use Illuminate\Console\Command;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Synchronization\Application\Services\WebhookManagerService;

/**
 * Registers missing WooCommerce webhooks for active channels.
 *
 * Usage:
 *   php artisan webhooks:register                  # all active channels
 *   php artisan webhooks:register --channel=<uuid> # one specific channel
 *
 * Safe to run multiple times — WebhookManagerService skips topics whose
 * ID column is already non-null (idempotent).
 */
final class RegisterWebhooksCommand extends Command
{
    protected $signature = 'webhooks:register
                            {--channel= : UUID of a specific channel to register webhooks for}';

    protected $description = 'Register missing WooCommerce webhooks for active channels.';

    private const WEBHOOK_COLUMNS = [
        'order.created' => 'external_webhook_order_created_id',
        'order.updated' => 'external_webhook_order_updated_id',
        'product.created' => 'external_webhook_product_created_id',
        'product.updated' => 'external_webhook_product_updated_id',
        'product.deleted' => 'external_webhook_product_deleted_id',
        'customer.created' => 'external_webhook_customer_created_id',
        'customer.updated' => 'external_webhook_customer_updated_id',
    ];

    public function handle(WebhookManagerService $webhookManager): int
    {
        $channels = $this->resolveChannels();

        if ($channels->isEmpty()) {
            $this->warn('No channels found.');

            return self::FAILURE;
        }

        foreach ($channels as $channel) {
            $this->registerForChannel($channel, $webhookManager);
        }

        return self::SUCCESS;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Channel>
     */
    private function resolveChannels(): \Illuminate\Database\Eloquent\Collection
    {
        $channelId = $this->option('channel');

        if ($channelId !== null) {
            $channel = Channel::query()->with('credential')->find($channelId);

            if ($channel === null) {
                $this->error("Channel [{$channelId}] not found.");

                return Channel::query()->whereRaw('1=0')->get();
            }

            return Channel::query()->with('credential')->where('id', $channelId)->get();
        }

        return Channel::query()
            ->with('credential')
            ->where('is_active', true)
            ->whereNotNull('id')
            ->get();
    }

    private function registerForChannel(Channel $channel, WebhookManagerService $webhookManager): void
    {
        $this->line('');
        $this->info("Channel: {$channel->name} ({$channel->id})");

        if ($channel->credential === null) {
            $this->warn('  ⚠  No credentials — skipping.');

            return;
        }

        // Snapshot which topics are already registered before calling registerAll().
        $before = $this->snapshotColumns($channel);

        $webhookManager->registerAll($channel);

        // Refresh to pick up any columns that were just written.
        $channel->refresh();
        $after = $this->snapshotColumns($channel);

        foreach (self::WEBHOOK_COLUMNS as $topic => $column) {
            $wasMissing = $before[$column] === null;
            $isNowSet = $after[$column] !== null;

            if (! $wasMissing) {
                $this->line("  ✓  <fg=gray>{$topic}</> already registered ({$after[$column]})");
            } elseif ($isNowSet) {
                $this->line("  ✓  <fg=green>{$topic}</> registered → {$after[$column]}");
            } else {
                $this->line("  ✗  <fg=red>{$topic}</> FAILED — check store URL, credentials, and APP_URL");
            }
        }
    }

    /**
     * @return array<string, string|null>
     */
    private function snapshotColumns(Channel $channel): array
    {
        $snapshot = [];

        foreach (self::WEBHOOK_COLUMNS as $column) {
            $snapshot[$column] = $channel->$column;
        }

        return $snapshot;
    }
}
