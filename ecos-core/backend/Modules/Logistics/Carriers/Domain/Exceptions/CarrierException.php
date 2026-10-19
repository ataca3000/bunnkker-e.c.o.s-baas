<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Domain\Exceptions;

use RuntimeException;

/** Raised when an operation would violate a Carriers business rule. Rendered as 422. */
class CarrierException extends RuntimeException
{
    public static function unknownAdapter(string $key): self
    {
        return new self(
            "No carrier adapter is registered under \"{$key}\". Register the adapter before "
            .'connecting an account — falling back to another carrier would send shipments to '
            .'the wrong place.'
        );
    }

    public static function capabilityNotSupported(string $carrier, string $capability): self
    {
        return new self(
            "{$carrier} does not support {$capability}. "
            .\Modules\Logistics\Carriers\Domain\ValueObjects\CarrierCapabilitySet::absenceMeaning($capability)
        );
    }

    public static function accountNotActive(string $status): self
    {
        return new self("This carrier account is {$status} and cannot be used.");
    }

    /** The integration-gap signal — recorded and queued, never guessed. */
    public static function statusUnmapped(string $carrier, string $rawStatus): self
    {
        return new self(
            "{$carrier} sent the status \"{$rawStatus}\", which has no ECOS mapping. It has been "
            .'recorded for review rather than guessed — a wrong status applied to a customer '
            .'order is worse than a visible gap.'
        );
    }

    public static function signatureVerificationFailed(string $carrier): self
    {
        return new self("The webhook signature from {$carrier} could not be verified.");
    }

    public static function credentialsMissing(): self
    {
        return new self(
            'This account has no credentials. Store them through the Provider Platform first.'
        );
    }
}
