<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\ValueObjects;

use DateTimeImmutable;
use InvalidArgumentException;

final readonly class CustomerSnapshot
{
    public function __construct(
        public string $customerId,
        public string $customerCode,
        public string $name,
        public ?string $email,
        public ?string $phone,
        public DateTimeImmutable $capturedAt,
    ) {}

    public static function capture(
        string $customerId,
        string $customerCode,
        string $name,
        ?string $email,
        ?string $phone,
        DateTimeImmutable $capturedAt,
    ): self {
        if (trim($customerId) === '') {
            throw new InvalidArgumentException('Customer ID cannot be empty.');
        }

        if (trim($name) === '') {
            throw new InvalidArgumentException('Customer name cannot be empty.');
        }

        return new self(
            customerId: $customerId,
            customerCode: $customerCode,
            name: $name,
            email: ($email !== null && trim($email) !== '') ? $email : null,
            phone: ($phone !== null && trim($phone) !== '') ? $phone : null,
            capturedAt: $capturedAt,
        );
    }

    public function hasEmail(): bool
    {
        return $this->email !== null;
    }

    public function hasPhone(): bool
    {
        return $this->phone !== null;
    }

    public function displayName(): string
    {
        return trim($this->customerCode) !== ''
            ? "{$this->name} ({$this->customerCode})"
            : $this->name;
    }

    public function toArray(): array
    {
        return [
            'customer_id' => $this->customerId,
            'customer_code' => $this->customerCode,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'captured_at' => $this->capturedAt->format('Y-m-d\TH:i:s\Z'),
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            customerId: $data['customer_id'],
            customerCode: $data['customer_code'],
            name: $data['name'],
            email: $data['email'] ?? null,
            phone: $data['phone'] ?? null,
            capturedAt: new DateTimeImmutable($data['captured_at']),
        );
    }
}
