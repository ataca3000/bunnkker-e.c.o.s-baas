<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Domain\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final readonly class PaymentTender
{
    public function __construct(
        public string $id,
        public PaymentMethodType $type,
        public Money $amount,
        public ?string $reference,
        public array $metadata,
    ) {}

    public static function create(
        PaymentMethodType $type,
        Money $amount,
        ?string $reference = null,
        array $metadata = [],
    ): self {
        if (! $amount->isPositive()) {
            throw new InvalidArgumentException(
                "Tender amount must be positive, got: {$amount->amount} {$amount->currency}.",
            );
        }

        return new self(
            id: self::generateUuid(),
            type: $type,
            amount: $amount,
            reference: $reference,
            metadata: $metadata,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'amount' => $this->amount->toArray(),
            'reference' => $this->reference,
            'metadata' => $this->metadata,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            id: $data['id'],
            type: PaymentMethodType::from($data['type']),
            amount: Money::fromArray($data['amount']),
            reference: $data['reference'] ?? null,
            metadata: $data['metadata'] ?? [],
        );
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
