<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\ValueObjects;

use InvalidArgumentException;

final readonly class ReceiptPayment
{
    public function __construct(
        public string $paymentMethod,
        public string $amount,
        public string $currency,
        public ?string $reference,
    ) {}

    public static function of(
        string $paymentMethod,
        string $amount,
        string $currency,
        ?string $reference = null,
    ): self {
        if (trim($paymentMethod) === '') {
            throw new InvalidArgumentException('Payment method cannot be empty.');
        }
        if (trim($currency) === '') {
            throw new InvalidArgumentException('Currency cannot be empty.');
        }

        return new self(
            paymentMethod: trim($paymentMethod),
            amount: $amount,
            currency: strtoupper(trim($currency)),
            reference: $reference !== null ? trim($reference) : null,
        );
    }

    public function toArray(): array
    {
        return [
            'payment_method' => $this->paymentMethod,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'reference' => $this->reference,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            paymentMethod: $data['payment_method'],
            amount: $data['amount'],
            currency: $data['currency'],
            reference: $data['reference'] ?? null,
        );
    }
}
