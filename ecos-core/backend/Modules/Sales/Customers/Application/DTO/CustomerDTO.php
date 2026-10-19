<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Application\DTO;

use App\Core\DTO\BaseDTO;

final class CustomerDTO extends BaseDTO
{
    public function __construct(
        public readonly string  $code,
        public readonly string  $name,
        // brand_id carries the initial brand on creation; null on update (brand management is separate).
        public readonly ?string $brand_id = null,
        // company_id is injected server-side on create; never updated.
        public readonly ?string $company_id = null,
        public readonly ?string $contact_person = null,
        public readonly ?string $email = null,
        public readonly ?string $phone = null,
        public readonly ?string $mobile = null,
        public readonly ?string $country = null,
        public readonly ?string $city = null,
        public readonly ?string $address = null,
        public readonly ?string $notes = null,
        public readonly bool    $is_active = true,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            code:       (string) $data['code'],
            name:       (string) $data['name'],
            brand_id:   self::nullableString($data, 'brand_id'),
            company_id: self::nullableString($data, 'company_id'),
            contact_person: self::nullableString($data, 'contact_person'),
            email: self::nullableString($data, 'email'),
            phone: self::nullableString($data, 'phone'),
            mobile: self::nullableString($data, 'mobile'),
            country: self::nullableString($data, 'country'),
            city: self::nullableString($data, 'city'),
            address: self::nullableString($data, 'address'),
            notes: self::nullableString($data, 'notes'),
            is_active: (bool) ($data['is_active'] ?? true),
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function nullableString(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return $value === null || $value === '' ? null : (string) $value;
    }
}
