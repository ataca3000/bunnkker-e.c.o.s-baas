<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Immutable input for creating/updating a supplier. Property names map directly
 * to the `suppliers` table columns.
 */
final class SupplierDTO extends BaseDTO
{
    public function __construct(
        public readonly string $code,
        public readonly string $name,
        public readonly ?string $contact_person = null,
        public readonly ?string $email = null,
        public readonly ?string $phone = null,
        public readonly ?string $mobile = null,
        public readonly ?string $country = null,
        public readonly ?string $city = null,
        public readonly ?string $address = null,
        public readonly ?string $notes = null,
        public readonly bool $is_active = true,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            code: (string) $data['code'],
            name: (string) $data['name'],
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
