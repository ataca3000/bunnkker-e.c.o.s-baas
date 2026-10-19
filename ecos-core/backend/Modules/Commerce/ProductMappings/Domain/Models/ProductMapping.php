<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;
use Modules\Commerce\ProductMappings\Infrastructure\Database\Factories\ProductMappingFactory;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Maps an ECOS product to an external channel product.
 *
 * @property string $id
 * @property string $product_id
 * @property string $channel_id
 * @property string $external_product_id
 * @property string|null $external_sku
 * @property SyncStatus $sync_status
 * @property \Illuminate\Support\Carbon|null $last_sync_at
 */
class ProductMapping extends Model
{
    /** @use HasFactory<ProductMappingFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'product_channel_mappings';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'channel_id',
        'external_product_id',
        'external_sku',
        'sync_status',
        'last_sync_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sync_status' => SyncStatus::class,
            'last_sync_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<Channel, $this>
     */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    protected static function newFactory(): ProductMappingFactory
    {
        return ProductMappingFactory::new();
    }
}
