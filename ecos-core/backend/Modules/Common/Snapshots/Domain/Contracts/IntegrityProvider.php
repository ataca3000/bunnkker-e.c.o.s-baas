<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Contracts;

/**
 * Provides the canonical string used by IntegrityEngine to compute + verify SHA-256 hashes.
 * Each aggregate builds its own canonical format; the engine only computes hashes.
 */
interface IntegrityProvider
{
    /** Build the deterministic canonical string used as input to the SHA-256 integrity hash. */
    public function buildIntegrityCanonical(): string;
}
