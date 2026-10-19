<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

/**
 * Contract for Digital Twin providers.
 * A provider maintains a mirrored, in-memory representation of a real entity
 * that can be used for simulation and what-if analysis without touching live data.
 *
 * No implementation exists yet — this is the stable contract that future
 * Digital Twin engines must satisfy.
 */
interface DigitalTwinProviderInterface
{
    /**
     * Return the digital (mirrored) representation of an entity.
     * Keys vary by entity type; must include id and entity_type.
     */
    public function mirror(string $entityType, string $entityId): array;

    /**
     * Synchronize the twin's internal state with the current real entity state.
     *
     * @param  array  $realState  Result of EntityStateResolver::resolve()
     */
    public function synchronize(array $realState): void;

    public function getProviderName(): string;
}
