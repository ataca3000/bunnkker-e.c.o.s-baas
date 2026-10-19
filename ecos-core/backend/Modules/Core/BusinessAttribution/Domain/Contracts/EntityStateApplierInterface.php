<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Contracts;

use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

interface EntityStateApplierInterface
{
    public function supports(string $entityType): bool;

    /**
     * Apply a single immutable business event to the accumulated state.
     * Returns the new state — never mutates the input.
     */
    public function apply(array $currentState, BusinessEvent $event): array;

    /**
     * Return the zero-value (empty) state for a newly encountered entity.
     */
    public function initialState(string $entityId): array;
}
