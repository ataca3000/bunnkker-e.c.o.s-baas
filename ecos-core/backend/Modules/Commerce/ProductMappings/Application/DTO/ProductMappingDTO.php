<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Application\DTO;

use App\Core\DTO\BaseDTO;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;

final class ProductMappingDTO extends BaseDTO
{
    public function __construct(
        public readonly string $product_id,
        public readonly string $channel_id,
        public readonly string $external_product_id,
        public readonly ?string $external_sku,
        public readonly SyncStatus $sync_status,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            product_id: (string) $data['product_id'],
            channel_id: (string) $data['channel_id'],
            external_product_id: (string) $data['external_product_id'],
            external_sku: isset($data['external_sku']) && $data['external_sku'] !== '' ? (string) $data['external_sku'] : null,
            sync_status: SyncStatus::from((string) ($data['sync_status'] ?? SyncStatus::Pending->value)),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toAttributes(): array
    {
        return [
            'product_id' => $this->product_id,
            'channel_id' => $this->channel_id,
            'external_product_id' => $this->external_product_id,
            'external_sku' => $this->external_sku,
            'sync_status' => $this->sync_status->value,
        ];
    }
}
