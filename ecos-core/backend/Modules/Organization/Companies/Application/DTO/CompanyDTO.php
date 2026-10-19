<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Immutable input for creating/updating a company. Property names map directly
 * to the `companies` table columns.
 */
final class CompanyDTO extends BaseDTO
{
    public function __construct(
        public readonly string $code,
        public readonly string $name,
        public readonly ?string $legal_name = null,
        public readonly ?string $tax_number = null,
        public readonly ?string $commercial_registration = null,
        public readonly ?string $email = null,
        public readonly ?string $phone = null,
        public readonly ?string $mobile = null,
        public readonly ?string $website = null,
        public readonly ?string $currency = null,
        public readonly ?string $timezone = null,
        public readonly ?string $language = null,
        public readonly ?string $description = null,
        public readonly ?string $country = null,
        public readonly ?string $city = null,
        public readonly ?string $address = null,
        public readonly ?string $postal_code = null,
        public readonly ?string $logo = null,
        public readonly bool $is_active = true,
        // Company Context fields
        public readonly ?string $locale = null,
        public readonly ?string $date_format = null,
        public readonly ?string $number_format = null,
        public readonly ?string $week_start = null,
        public readonly ?string $fiscal_year_start = null,
        public readonly ?string $fiscal_year_end = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            code: (string) $data['code'],
            name: (string) $data['name'],
            legal_name: self::nullableString($data, 'legal_name'),
            tax_number: self::nullableString($data, 'tax_number'),
            commercial_registration: self::nullableString($data, 'commercial_registration'),
            email: self::nullableString($data, 'email'),
            phone: self::nullableString($data, 'phone'),
            mobile: self::nullableString($data, 'mobile'),
            website: self::nullableString($data, 'website'),
            currency: self::nullableString($data, 'currency'),
            timezone: self::nullableString($data, 'timezone'),
            language: self::nullableString($data, 'language'),
            description: self::nullableString($data, 'description'),
            country: self::nullableString($data, 'country'),
            city: self::nullableString($data, 'city'),
            address: self::nullableString($data, 'address'),
            postal_code: self::nullableString($data, 'postal_code'),
            logo: self::nullableString($data, 'logo'),
            is_active: (bool) ($data['is_active'] ?? true),
            locale: self::nullableString($data, 'locale'),
            date_format: self::nullableString($data, 'date_format'),
            number_format: self::nullableString($data, 'number_format'),
            week_start: self::nullableString($data, 'week_start'),
            fiscal_year_start: self::nullableString($data, 'fiscal_year_start'),
            fiscal_year_end: self::nullableString($data, 'fiscal_year_end'),
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
