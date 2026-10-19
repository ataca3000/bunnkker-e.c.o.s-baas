<?php

declare(strict_types=1);

namespace Modules\Commerce\StockSync\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Carbon;
use Modules\Commerce\Channels\Domain\Contracts\ChannelRepositoryInterface;
use Modules\Commerce\Channels\Domain\Exceptions\ChannelNotFoundException;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Commerce\StockSync\Application\Services\WooCommerceStockSyncer;
use Modules\Commerce\StockSync\Domain\Enums\StockSyncStatus;
use Modules\Commerce\StockSync\Domain\Models\StockSyncLog;
use Modules\Purchasing\GoodsReceipts\Domain\Models\StockBalance;

final class SyncStockAction extends BaseAction
{
    public function __construct(
        private readonly ChannelRepositoryInterface $channels,
        private readonly WooCommerceStockSyncer $syncer,
    ) {}

    /**
     * Arguments:
     *   [0] channel_id (string)
     *   [1] product_ids (array<string>|null) — null syncs all mapped products for the channel
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $channelId = (string) ($arguments[0] ?? '');
        /** @var array<string>|null $productIds */
        $productIds = $arguments[1] ?? null;

        $channel = $this->channels->findById($channelId);

        if ($channel === null) {
            throw new ChannelNotFoundException($channelId);
        }

        $credential = $channel->credential;

        if ($credential === null) {
            return OperationResult::failure('No credentials configured for this channel.');
        }

        $query = ProductMapping::query()
            ->whereNull('deleted_at')
            ->where('channel_id', $channelId);

        if ($productIds !== null) {
            $query->whereIn('product_id', $productIds);
        }

        $mappings = $query->get();

        $syncedCount = 0;
        $errorCount = 0;
        $now = Carbon::now();

        foreach ($mappings as $mapping) {
            /** @var ProductMapping $mapping */
            $totalStock = (float) StockBalance::query()
                ->where('product_id', $mapping->product_id)
                ->sum('quantity');

            $success = $this->syncer->updateStock(
                $channel->store_url,
                $credential->consumer_key,
                $credential->consumer_secret,
                $mapping->external_product_id,
                $totalStock,
            );

            $syncStatus = $success ? StockSyncStatus::Success : StockSyncStatus::Error;
            $message = $success
                ? 'Stock updated successfully.'
                : 'Failed to update stock on WooCommerce.';

            StockSyncLog::create([
                'channel_id' => $channelId,
                'product_id' => $mapping->product_id,
                'product_mapping_id' => $mapping->id,
                'stock_quantity' => $totalStock,
                'sync_status' => $syncStatus->value,
                'response_message' => $message,
                'synced_at' => $now,
            ]);

            if ($success) {
                $mapping->update([
                    'sync_status' => SyncStatus::Synced->value,
                    'last_sync_at' => $now,
                ]);
                $syncedCount++;
            } else {
                $mapping->update(['sync_status' => SyncStatus::Error->value]);
                $errorCount++;
            }
        }

        return OperationResult::success(
            [
                'synced' => $syncedCount,
                'errors' => $errorCount,
                'total' => $mappings->count(),
            ],
            "Sync complete. {$syncedCount} synced, {$errorCount} errors.",
        );
    }
}
