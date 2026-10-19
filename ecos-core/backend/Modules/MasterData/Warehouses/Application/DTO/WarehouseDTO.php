<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Application\DTO;

use App\Core\DTO\BaseDTO;

final class WarehouseDTO extends BaseDTO
{
    public function __construct(
        public readonly string $company_id,
        public readonly string $name,
        public readonly ?string $code = null,
        public readonly ?string $address = null,
        public readonly ?string $city = null,
        public readonly ?string $country = null,
        public readonly bool $is_active = true,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $value = fn (array $d, string $k): ?string => isset($d[$k]) && $d[$k] !== '' ? (string) $d[$k] : null;

        return new self(
            company_id: isset($data['company_id']) && $data['company_id'] !== '' ? (string) $data['company_id'] : '',
            name: (string) $data['name'],
            code: $value($data, 'code'),
            address: $value($data, 'address'),
            city: $value($data, 'city'),
            country: $value($data, 'country'),
            is_active: (bool) ($data['is_active'] ?? true),
        );
    }
}
