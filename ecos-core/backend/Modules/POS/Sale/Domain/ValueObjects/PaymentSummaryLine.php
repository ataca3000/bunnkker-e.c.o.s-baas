<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Domain\ValueObjects;

use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final readonly class PaymentSummaryLine
{
    public function __construct(
        public PaymentMethodType $type,
        public Money $amount,
        public ?string $reference,
    ) {}

    /**
     * Build a payment snapshot from a PaymentTender::toArray() payload.
     */
    public static function fromTender(array $data): self
    {
        return new self(
            type: PaymentMethodType::from($data['type']),
            amount: Money::fromArray($data['amount']),
            reference: $data['reference'] ?? null,
        );
    }

    public function toArray(): array
    {
        return [
            'type' => $this->type->value,
            'amount' => $this->amount->toArray(),
            'reference' => $this->reference,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            type: PaymentMethodType::from($data['type']),
            amount: Money::fromArray($data['amount']),
            reference: $data['reference'] ?? null,
        );
    }
}
