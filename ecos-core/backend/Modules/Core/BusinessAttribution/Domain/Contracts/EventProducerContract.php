<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

/**
 * Interface for any ECOS module that produces Business Events.
 *
 * Modules do NOT need to implement this interface directly — they may call
 * BusinessEventBusService::publish() directly from their application layer.
 * This contract is provided for modules that prefer dependency injection.
 */
interface EventProducerContract
{
    /**
     * Publish a standardized Business Event into the BAE Event Bus.
     *
     * @param  array{
     *   event_name: string,
     *   category: string,
     *   producer_module: string,
     *   producer_entity: string,
     *   entity_id?: string|null,
     *   entity_type?: string|null,
     *   company_id?: string|null,
     *   brand_id?: string|null,
     *   channel_id?: string|null,
     *   warehouse_id?: string|null,
     *   business_unit?: string|null,
     *   cost_center?: string|null,
     *   actor_id?: string|null,
     *   actor_type?: string|null,
     *   occurred_at?: string|null,
     *   correlation_id?: string|null,
     *   business_dna_id?: string|null,
     *   payload: array<string, mixed>,
     *   metadata?: array<string, mixed>|null,
     *   version?: string,
     * } $eventData
     */
    public function publishEvent(array $eventData): void;
}
