<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Application\DTO;

use App\Core\DTO\BaseDTO;
use Modules\Commerce\Channels\Domain\Enums\ChannelPlatform;

final class ChannelDTO extends BaseDTO
{
    public function __construct(
        public readonly string $brand_id,
        public readonly string $name,
        public readonly ChannelPlatform $platform,
        public readonly string $store_url,
        public readonly bool $is_active = true,
        public readonly bool $sync_products = true,
        public readonly bool $sync_prices = true,
        public readonly bool $sync_stock = true,
        public readonly bool $sync_customers = true,
        public readonly ?string $consumer_key = null,
        public readonly ?string $consumer_secret = null,
        public readonly ?string $code = null,
        public readonly ?string $channel_type = null,
        public readonly ?string $channel_role = null,
        public readonly ?string $business_account_id = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $ns = fn (array $d, string $k): ?string => isset($d[$k]) && $d[$k] !== '' ? (string) $d[$k] : null;

        return new self(
            brand_id: (string) $data['brand_id'],
            name: (string) $data['name'],
            platform: ChannelPlatform::from((string) $data['platform']),
            store_url: (string) $data['store_url'],
            is_active: (bool) ($data['is_active'] ?? true),
            sync_products: (bool) ($data['sync_products'] ?? true),
            sync_prices: (bool) ($data['sync_prices'] ?? true),
            sync_stock: (bool) ($data['sync_stock'] ?? true),
            sync_customers: (bool) ($data['sync_customers'] ?? true),
            consumer_key: $ns($data, 'consumer_key'),
            consumer_secret: $ns($data, 'consumer_secret'),
            code: $ns($data, 'code'),
            channel_type: $ns($data, 'channel_type'),
            channel_role: $ns($data, 'channel_role'),
            business_account_id: $ns($data, 'business_account_id'),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function channelAttributes(): array
    {
        return [
            'brand_id' => $this->brand_id,
            'business_account_id' => $this->business_account_id,
            'name' => $this->name,
            'channel_type' => $this->channel_type,
            'channel_role' => $this->channel_role,
            'platform' => $this->platform->value,
            'store_url' => $this->store_url,
            'is_active' => $this->is_active,
            'sync_products' => $this->sync_products,
            'sync_prices' => $this->sync_prices,
            'sync_stock' => $this->sync_stock,
            'sync_customers' => $this->sync_customers,
        ];
    }

    /**
     * @return array<string, string>|null
     */
    public function credentialAttributes(): ?array
    {
        if ($this->consumer_key === null && $this->consumer_secret === null) {
            return null;
        }

        return [
            'consumer_key' => $this->consumer_key ?? '',
            'consumer_secret' => $this->consumer_secret ?? '',
        ];
    }
}
