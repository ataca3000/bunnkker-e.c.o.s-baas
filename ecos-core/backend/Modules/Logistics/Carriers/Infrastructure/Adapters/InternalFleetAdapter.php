<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Infrastructure\Adapters;

use Illuminate\Support\Carbon;
use Modules\Logistics\Carriers\Domain\Contracts\CarrierAdapterInterface;
use Modules\Logistics\Carriers\Domain\Models\CarrierAccount;
use Modules\Logistics\Carriers\Domain\ValueObjects\CarrierCapabilitySet;
use Modules\Logistics\Carriers\Domain\ValueObjects\NormalizedCarrierEvent;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;

/**
 * OWN FLEET AS A CARRIER.
 *
 * Modelling our own fleet as just another adapter is what makes the abstraction
 * real rather than decorative: the core cannot tell the difference between
 * delivering ourselves and tendering out, so there is exactly one tendering
 * path and one status pipeline rather than two.
 *
 * It needs no credentials, no network and no webhook — its "carrier" is
 * Distribution and Delivery, which are already in the building. That is why
 * testConnection() always succeeds and parseWebhook() maps ECOS's own
 * vocabulary straight through.
 */
final class InternalFleetAdapter implements CarrierAdapterInterface
{
    public const KEY = 'internal_fleet';

    public function key(): string
    {
        return self::KEY;
    }

    public function displayName(): string
    {
        return 'Own Fleet';
    }

    /**
     * Everything except rating and labels.
     *
     * We do not quote ourselves, and an own-fleet delivery carries no carrier
     * label — the trip manifest serves that purpose.
     */
    public function capabilities(CarrierAccount $account): CarrierCapabilitySet
    {
        return CarrierCapabilitySet::of([
            CarrierCapabilitySet::TRACKING,
            CarrierCapabilitySet::WEBHOOKS,
            CarrierCapabilitySet::CANCELLATION,
            CarrierCapabilitySet::PROOF_OF_DELIVERY,
            CarrierCapabilitySet::COD,
            CarrierCapabilitySet::MULTI_PIECE,
        ]);
    }

    /** Always reachable — the "carrier" is this application. */
    public function testConnection(CarrierAccount $account): array
    {
        return [
            'ok' => true,
            'message' => 'Own fleet is served by Distribution and Delivery; no external connection is required.',
            'checked_at' => Carbon::now()->toIso8601String(),
        ];
    }

    /**
     * Internal events already speak ECOS, so this is a pass-through with
     * validation rather than a translation.
     *
     * An unrecognised status is still reported as unmapped — even our own
     * vocabulary can drift, and guessing would defeat the point.
     */
    public function parseWebhook(CarrierAccount $account, array $payload): NormalizedCarrierEvent
    {
        $eventId = (string) ($payload['event_id'] ?? uniqid('internal_', true));
        $rawStatus = (string) ($payload['status'] ?? '');

        $status = DeliveryStatus::tryFrom($rawStatus);

        if ($status === null) {
            return NormalizedCarrierEvent::unmapped(
                $eventId,
                $rawStatus,
                $payload['tracking_number'] ?? null,
                $payload['occurred_at'] ?? null,
                ['source' => 'internal_fleet'],
            );
        }

        return NormalizedCarrierEvent::mapped(
            carrierEventId: $eventId,
            rawStatus: $rawStatus,
            deliveryStatus: $status,
            trackingNumber: $payload['tracking_number'] ?? null,
            occurredAt: $payload['occurred_at'] ?? null,
            metadata: ['source' => 'internal_fleet'],
        );
    }

    /**
     * No signature: an internal event never crosses a trust boundary. Returning
     * true here is a deliberate statement, not an oversight — external adapters
     * must implement this properly.
     */
    public function verifyWebhookSignature(
        CarrierAccount $account,
        array $payload,
        array $headers = [],
    ): bool {
        return true;
    }
}
