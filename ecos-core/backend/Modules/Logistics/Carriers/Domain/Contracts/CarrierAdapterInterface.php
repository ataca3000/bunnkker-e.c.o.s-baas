<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Domain\Contracts;

use Modules\Logistics\Carriers\Domain\Models\CarrierAccount;
use Modules\Logistics\Carriers\Domain\ValueObjects\CarrierCapabilitySet;
use Modules\Logistics\Carriers\Domain\ValueObjects\NormalizedCarrierEvent;

/**
 * ┌─ DIRECTIVE 9 — ADAPTER PATTERN ─────────────────────────────────────────┐
 * │                                                                          │
 * │ The core domain knows a carrier ONLY through this interface. Four rules  │
 * │ make it a real anticorruption layer rather than a naming convention:     │
 * │                                                                          │
 * │ 1. FOREIGN VOCABULARY STOPS HERE. parseWebhook() returns                 │
 * │    NormalizedCarrierEvent, which speaks ECOS enums. No carrier string    │
 * │    travels past its adapter.                                             │
 * │                                                                          │
 * │ 2. UNMAPPABLE IS EXPLICIT. An unknown status becomes                     │
 * │    NormalizedCarrierEvent::unmapped() and goes to a queue a human works. │
 * │    It is never coerced to a "closest" match.                             │
 * │                                                                          │
 * │ 3. CAPABILITIES ARE DECLARED, THEN ASKED. capabilities() is checked      │
 * │    before a call is made; a missing capability is a normal answer.       │
 * │                                                                          │
 * │ 4. ADAPTERS WRITE NOTHING. An adapter returns data. It does not write a  │
 * │    delivery_* row, dispatch another context's event, or call another     │
 * │    module's service. A listener does that, through Delivery's own        │
 * │    services, so BR-7 and BR-8 still apply to a carrier-delivered order.  │
 * │                                                                          │
 * │ Adding carrier #16 is a new class in                                     │
 * │ Carriers/Infrastructure/Adapters/<Name>/ plus configuration — nothing    │
 * │ outside that folder changes.                                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Phase 2 ships the FOUNDATION only: this interface, the internal fleet
 * adapter, an external base class and the factory. No provider integration.
 */
interface CarrierAdapterInterface
{
    /** Registry key. The only place a carrier is named outside its adapter. */
    public function key(): string;

    public function displayName(): string;

    /** What this carrier can do. Asked before anything is called. */
    public function capabilities(CarrierAccount $account): CarrierCapabilitySet;

    /**
     * Can we reach it, and are the credentials valid?
     *
     * @return array{ok: bool, message: string, checked_at: string}
     */
    public function testConnection(CarrierAccount $account): array;

    /**
     * Translate a raw inbound payload into ECOS vocabulary.
     *
     * @param  array<string, mixed>  $payload
     */
    public function parseWebhook(CarrierAccount $account, array $payload): NormalizedCarrierEvent;

    /**
     * Verify the payload really came from the carrier.
     *
     * Each carrier signs differently — that is carrier-specific knowledge and
     * belongs nowhere else.
     *
     * @param  array<string, mixed>  $payload
     * @param  array<string, string>  $headers
     */
    public function verifyWebhookSignature(
        CarrierAccount $account,
        array $payload,
        array $headers = [],
    ): bool;
}
