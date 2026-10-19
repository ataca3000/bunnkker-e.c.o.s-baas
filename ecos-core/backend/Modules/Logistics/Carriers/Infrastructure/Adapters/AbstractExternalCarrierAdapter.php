<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Infrastructure\Adapters;

use Illuminate\Support\Carbon;
use Modules\Logistics\Carriers\Domain\Contracts\CarrierAdapterInterface;
use Modules\Logistics\Carriers\Domain\Models\CarrierAccount;
use Modules\Logistics\Carriers\Domain\ValueObjects\CarrierCapabilitySet;
use Modules\Logistics\Carriers\Domain\ValueObjects\NormalizedCarrierEvent;

/**
 * Base class for every third-party carrier adapter.
 *
 * Phase 2 ships this FOUNDATION only — no provider-specific integration (D4/D7:
 * carrier order follows business priority). A concrete adapter extends this,
 * lives in Carriers/Infrastructure/Adapters/<Name>/, and is the ONLY place that
 * carrier is named.
 *
 * What this base gives every adapter for free:
 *
 *   • Status translation driven by carrier_status_mappings — DATA, so a new
 *     status is mapped by configuration rather than a deploy.
 *   • Unmapped statuses returned explicitly, never guessed.
 *   • A capability set read from the account's declarations.
 *
 * What a subclass must supply: its key, its display name, its signature scheme,
 * and how to pull the event id and raw status out of its own payload shape.
 */
abstract class AbstractExternalCarrierAdapter implements CarrierAdapterInterface
{
    abstract public function key(): string;

    abstract public function displayName(): string;

    /**
     * Extract the carrier's own event identifier. Used for deduplication —
     * carriers retry aggressively and duplicate delivery is normal.
     *
     * @param  array<string, mixed>  $payload
     */
    abstract protected function extractEventId(array $payload): string;

    /**
     * Extract the carrier's raw status string, in ITS vocabulary. Translation
     * happens in this base class, not in the subclass.
     *
     * @param  array<string, mixed>  $payload
     */
    abstract protected function extractRawStatus(array $payload): string;

    /**
     * Declared capabilities, from the account's stored declarations.
     *
     * A subclass may override to hardcode what its API genuinely offers, but
     * reading configuration by default means a carrier that enables a feature
     * on one account and not another is expressible without code.
     */
    public function capabilities(CarrierAccount $account): CarrierCapabilitySet
    {
        return CarrierCapabilitySet::of($account->supportedCapabilities());
    }

    /**
     * Default: not reachable until a subclass implements it.
     *
     * Failing closed matters — an adapter that silently reports "ok" without
     * talking to anything would let a broken carrier into the selection pool.
     */
    public function testConnection(CarrierAccount $account): array
    {
        return [
            'ok' => false,
            'message' => sprintf(
                'The %s adapter has no connection test implemented yet.',
                $this->displayName(),
            ),
            'checked_at' => Carbon::now()->toIso8601String(),
        ];
    }

    /**
     * Translate a raw payload using the account's configured mappings.
     *
     * An unmapped status is returned EXPLICITLY with the raw value preserved,
     * so it lands in the integration-gap queue rather than being coerced to a
     * "closest" match. A wrong status silently applied to a customer's order is
     * far worse than a visible gap.
     *
     * @param  array<string, mixed>  $payload
     */
    public function parseWebhook(CarrierAccount $account, array $payload): NormalizedCarrierEvent
    {
        $eventId = $this->extractEventId($payload);
        $rawStatus = $this->extractRawStatus($payload);

        $mapping = $account->statusMappings()
            ->where('carrier_status', $rawStatus)
            ->first();

        $deliveryStatus = $mapping?->toDeliveryStatus();

        if ($deliveryStatus === null) {
            return NormalizedCarrierEvent::unmapped(
                $eventId,
                $rawStatus,
                $this->extractTrackingNumber($payload),
                $this->extractOccurredAt($payload),
                ['adapter' => $this->key()],
            );
        }

        return NormalizedCarrierEvent::mapped(
            carrierEventId: $eventId,
            rawStatus: $rawStatus,
            deliveryStatus: $deliveryStatus,
            failureReason: $mapping?->toFailureReason(),
            trackingNumber: $this->extractTrackingNumber($payload),
            occurredAt: $this->extractOccurredAt($payload),
            metadata: ['adapter' => $this->key()],
        );
    }

    /**
     * Default: REJECT.
     *
     * Every carrier signs differently, so there is no safe generic
     * implementation. Failing closed means an unimplemented adapter cannot
     * accept forged webhooks.
     *
     * @param  array<string, mixed>  $payload
     * @param  array<string, string>  $headers
     */
    public function verifyWebhookSignature(
        CarrierAccount $account,
        array $payload,
        array $headers = [],
    ): bool {
        return false;
    }

    /** @param array<string, mixed> $payload */
    protected function extractTrackingNumber(array $payload): ?string
    {
        $value = $payload['tracking_number'] ?? $payload['awb'] ?? null;

        return $value !== null ? (string) $value : null;
    }

    /** @param array<string, mixed> $payload */
    protected function extractOccurredAt(array $payload): ?string
    {
        $value = $payload['occurred_at'] ?? $payload['timestamp'] ?? null;

        return $value !== null ? (string) $value : null;
    }
}
