<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Domain\ValueObjects;

/**
 * What a carrier can actually do.
 *
 * ┌─ DIRECTIVE 9 — CAPABILITIES ARE DECLARED, THEN ASKED ───────────────────┐
 * │ Carriers differ enormously: some rate, some do not; some push webhooks,  │
 * │ some require polling; some have no API at all. The core ASKS before it   │
 * │ calls, and a missing capability is a NORMAL answer, not an error.        │
 * │                                                                          │
 * │ Without this, every adapter would have to throw "not supported" and the  │
 * │ core would be littered with carrier-specific try/catch — which is        │
 * │ exactly the leak the adapter pattern exists to prevent.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CarrierCapabilitySet
{
    public const RATING = 'rating';

    public const LABEL_GENERATION = 'label_generation';

    public const WEBHOOKS = 'webhooks';

    public const CANCELLATION = 'cancellation';

    public const PROOF_OF_DELIVERY = 'proof_of_delivery';

    public const COD = 'cod';

    public const MULTI_PIECE = 'multi_piece';

    public const TRACKING = 'tracking';

    /** @var list<string> */
    public const ALL = [
        self::RATING,
        self::LABEL_GENERATION,
        self::WEBHOOKS,
        self::CANCELLATION,
        self::PROOF_OF_DELIVERY,
        self::COD,
        self::MULTI_PIECE,
        self::TRACKING,
    ];

    /** @param array<string, bool> $supported */
    private function __construct(private readonly array $supported) {}

    /** @param list<string> $capabilities */
    public static function of(array $capabilities): self
    {
        $map = [];

        foreach (self::ALL as $capability) {
            $map[$capability] = in_array($capability, $capabilities, true);
        }

        return new self($map);
    }

    public static function none(): self
    {
        return self::of([]);
    }

    public function supports(string $capability): bool
    {
        return $this->supported[$capability] ?? false;
    }

    /** @return list<string> */
    public function supportedList(): array
    {
        return array_keys(array_filter($this->supported));
    }

    /** @return array<string, bool> */
    public function toArray(): array
    {
        return $this->supported;
    }

    /**
     * What a missing capability MEANS operationally. Kept here so the reason a
     * feature is unavailable is answerable without opening an adapter.
     */
    public static function absenceMeaning(string $capability): string
    {
        return match ($capability) {
            self::RATING => 'No rate shopping; contract rates from LOG-001 are used.',
            self::LABEL_GENERATION => 'The carrier prints its own label; ECOS stores the tracking number only.',
            self::WEBHOOKS => 'Status arrives by scheduled polling instead of push.',
            self::CANCELLATION => 'Cancellation is a manual, out-of-band process.',
            self::PROOF_OF_DELIVERY => 'ECOS proof of delivery is not available for these shipments.',
            self::COD => 'Cash on delivery cannot be tendered to this carrier.',
            self::MULTI_PIECE => 'One shipment per order only.',
            self::TRACKING => 'No tracking updates; status must be entered manually.',
            default => 'This capability is not offered.',
        };
    }
}
