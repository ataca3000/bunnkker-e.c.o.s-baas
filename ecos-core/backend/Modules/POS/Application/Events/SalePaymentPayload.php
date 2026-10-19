<?php

declare(strict_types=1);

namespace Modules\POS\Application\Events;

use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;

/**
 * Immutable value object representing one payment tender inside SaleFinalized.
 *
 * Amounts are string-encoded decimals. Method is the PaymentMethodType enum value.
 */
final readonly class SalePaymentPayload
{
    public function __construct(
        public string $method,
        public string $amount,
        public string $currency,
        public ?string $reference,
    ) {}

    public static function fromPaymentSummaryLine(PaymentSummaryLine $line): self
    {
        return new self(
            method: $line->type->value,
            amount: $line->amount->amount,
            currency: $line->amount->currency,
            reference: $line->reference,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'method' => $this->method,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'reference' => $this->reference,
        ];
    }
}
