<?php

declare(strict_types=1);

namespace Modules\Commerce\StockSync\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Commerce\StockSync\Domain\Enums\StockSyncStatus;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * @property string $id
 * @property string $channel_id
 * @property string $product_id
 * @property string $product_mapping_id
 * @property float $stock_quantity
 * @property StockSyncStatus $sync_status
 * @property string|null $response_message
 * @property \Illuminate\Support\Carbon|null $synced_at
 */
class StockSyncLog extends Model
{
    use HasUuids;

    protected $table = 'stock_sync_logs';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'channel_id',
        'product_id',
        'product_mapping_id',
        'stock_quantity',
        'sync_status',
        'response_message',
        'synced_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sync_status' => StockSyncStatus::class,
            'synced_at' => 'datetime',
            'stock_quantity' => 'float',
        ];
    }

    /** @return BelongsTo<Channel, $this> */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<ProductMapping, $this> */
    public function productMapping(): BelongsTo
    {
        return $this->belongsTo(ProductMapping::class, 'product_mapping_id');
    }
}
