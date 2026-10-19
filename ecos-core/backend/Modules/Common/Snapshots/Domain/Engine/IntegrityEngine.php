<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Engine;

/**
 * SHA-256 integrity engine for immutable snapshots.
 *
 * This engine is intentionally dumb: it only computes and verifies hashes.
 * Each aggregate is responsible for building its own canonical string
 * (via IntegrityProvider::buildIntegrityCanonical()) so that the hash
 * format is owned by the domain, not by the platform.
 */
final class IntegrityEngine
{
    /**
     * Compute a SHA-256 hash over the given canonical string.
     * The canonical string must be deterministic for the same data.
     */
    public function compute(string $canonical): string
    {
        return hash('sha256', $canonical);
    }

    /**
     * Verify that a stored SHA-256 hash matches the hash of the canonical string.
     * Uses hash_equals to prevent timing attacks.
     *
     * @return bool True if the hash matches (data is intact); false if tampered.
     */
    public function verify(string $storedHash, string $canonical): bool
    {
        if ($storedHash === '') {
            return false;
        }

        return hash_equals($storedHash, hash('sha256', $canonical));
    }
}
