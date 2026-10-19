<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\ValueObjects;

use InvalidArgumentException;

final readonly class ReceiptTotals
{
    public function __construct(
        public string $subtotalAmount,
        public string $discountAmount,
        public string $taxAmount,
        public string $totalAmount,
        public string $tenderedAmount,
        public string $changeAmount,
        public string $currency,
    ) {}

    public static function of(
        string $subtotalAmount,
        string $discountAmount,
        string $taxAmount,
        string $totalAmount,
        string $tenderedAmount,
        string $changeAmount,
        string $currency,
    ): self {
        if (trim($currency) === '') {
            throw new InvalidArgumentException('Currency cannot be empty.');
        }

        return new self(
            subtotalAmount: $subtotalAmount,
            discountAmount: $discountAmount,
            taxAmount: $taxAmount,
            totalAmount: $totalAmount,
            tenderedAmount: $tenderedAmount,
            changeAmount: $changeAmount,
            currency: strtoupper(trim($currency)),
        );
    }

    public function toArray(): array
    {
        return [
            'subtotal_amount' => $this->subtotalAmount,
            'discount_amount' => $this->discountAmount,
            'tax_amount' => $this->taxAmount,
            'total_amount' => $this->totalAmount,
            'tendered_amount' => $this->tenderedAmount,
            'change_amount' => $this->changeAmount,
            'currency' => $this->currency,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            subtotalAmount: $data['subtotal_amount'],
            discountAmount: $data['discount_amount'],
            taxAmount: $data['tax_amount'],
            totalAmount: $data['total_amount'],
            tenderedAmount: $data['tendered_amount'],
            changeAmount: $data['change_amount'],
            currency: $data['currency'],
        );
    }
}
