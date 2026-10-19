<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Commerce\Channels\Domain\Enums\ChannelHealthStatus;
use Modules\Commerce\Channels\Domain\Enums\ChannelPlatform;
use Modules\Commerce\Channels\Domain\Enums\ConnectionStatus;
use Modules\Commerce\Channels\Infrastructure\Database\Factories\ChannelFactory;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;

/**
 * Commerce channel (WooCommerce store, Shopify shop, etc.).
 *
 * @property string $id
 * @property string $brand_id
 * @property string|null $business_account_id
 * @property string|null $code
 * @property string $name
 * @property string|null $channel_type
 * @property string|null $channel_role
 * @property ChannelPlatform $platform
 * @property string $store_url
 * @property bool $is_active
 * @property bool $sync_products
 * @property bool $sync_prices
 * @property bool $sync_stock
 * @property bool $sync_customers
 * @property string|null $external_webhook_order_created_id
 * @property string|null $external_webhook_order_updated_id
 * @property string|null $external_webhook_product_created_id
 * @property string|null $external_webhook_product_updated_id
 * @property string|null $external_webhook_product_deleted_id
 * @property string|null $external_webhook_customer_created_id
 * @property string|null $external_webhook_customer_updated_id
 * @property \Illuminate\Support\Carbon|null $last_sync_at
 * @property \Illuminate\Support\Carbon|null $last_webhook_received_at
 * @property \Illuminate\Support\Carbon|null $last_successful_sync_at
 * @property \Illuminate\Support\Carbon|null $last_error_at
 * @property string|null $last_error_message
 * @property ConnectionStatus $connection_status
 */
class Channel extends Model
{
    /** @use HasFactory<ChannelFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'brand_id',
        'business_account_id',
        'code',
        'name',
        'channel_type',
        'channel_role',
        'platform',
        'store_url',
        'is_active',
        'sync_products',
        'sync_prices',
        'sync_stock',
        'sync_customers',
        'external_webhook_order_created_id',
        'external_webhook_order_updated_id',
        'external_webhook_product_created_id',
        'external_webhook_product_updated_id',
        'external_webhook_product_deleted_id',
        'external_webhook_customer_created_id',
        'external_webhook_customer_updated_id',
        'last_sync_at',
        'last_webhook_received_at',
        'last_successful_sync_at',
        'last_error_at',
        'last_error_message',
        'connection_status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'platform' => ChannelPlatform::class,
            'is_active' => 'boolean',
            'sync_products' => 'boolean',
            'sync_prices' => 'boolean',
            'sync_stock' => 'boolean',
            'sync_customers' => 'boolean',
            'last_sync_at' => 'datetime',
            'last_webhook_received_at' => 'datetime',
            'last_successful_sync_at' => 'datetime',
            'last_error_at' => 'datetime',
            'connection_status' => ConnectionStatus::class,
        ];
    }

    /**
     * @return BelongsTo<Brand, $this>
     */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /**
     * @return BelongsTo<BusinessAccount, $this>
     */
    public function businessAccount(): BelongsTo
    {
        return $this->belongsTo(BusinessAccount::class);
    }

    /**
     * @return HasOne<ChannelCredential, $this>
     */
    public function credential(): HasOne
    {
        return $this->hasOne(ChannelCredential::class);
    }

    public function healthStatus(): ChannelHealthStatus
    {
        $lastSuccess = $this->last_successful_sync_at ?? $this->last_sync_at;

        if ($this->last_error_at !== null) {
            $erroredAfterSuccess = $lastSuccess === null || $this->last_error_at->gt($lastSuccess);

            if ($erroredAfterSuccess) {
                return ChannelHealthStatus::Error;
            }
        }

        if ($lastSuccess !== null && $lastSuccess->diffInHours(now()) > 24) {
            return ChannelHealthStatus::Warning;
        }

        if ($this->connection_status !== ConnectionStatus::Connected) {
            return ChannelHealthStatus::Warning;
        }

        return ChannelHealthStatus::Healthy;
    }

    protected static function newFactory(): ChannelFactory
    {
        return ChannelFactory::new();
    }
}
