<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Application\Services;

use Modules\Marketing\ProviderPlatform\Domain\ValueObjects\ProviderDefinition;

/**
 * Single source of truth for all registered marketing providers.
 *
 * Providers register their static metadata (capabilities, type, version) at boot
 * via ProviderPlatformServiceProvider.  The registry is then available for
 * capability lookups, health lookups, and dynamic feature gating — no hardcoded
 * provider-specific checks allowed in application code.
 *
 * Usage:
 *   $def = $registry->resolve('meta');
 *   $def->supports(ProviderCapability::ADS);  // true
 *   $registry->findByCapability(ProviderCapability::COMMERCE);  // [meta, ...]
 */
final class ProviderRegistry
{
    /** @var array<string, ProviderDefinition> keyed by providerKey */
    private array $definitions = [];

    public function register(ProviderDefinition $definition): void
    {
        $this->definitions[$definition->providerKey] = $definition;
    }

    public function resolve(string $providerKey): ?ProviderDefinition
    {
        return $this->definitions[$providerKey] ?? null;
    }

    public function has(string $providerKey): bool
    {
        return isset($this->definitions[$providerKey]);
    }

    /**
     * @return list<ProviderDefinition>
     */
    public function all(): array
    {
        return array_values($this->definitions);
    }

    /**
     * @return list<string> provider keys
     */
    public function keys(): array
    {
        return array_keys($this->definitions);
    }

    /**
     * Returns all providers that expose the given capability.
     *
     * @return list<ProviderDefinition>
     */
    public function findByCapability(string $capability): array
    {
        return array_values(
            array_filter($this->definitions, fn ($d) => $d->supports($capability)),
        );
    }

    /**
     * Returns all providers of a given type (e.g. "social_platform").
     *
     * @return list<ProviderDefinition>
     */
    public function findByType(string $providerType): array
    {
        return array_values(
            array_filter($this->definitions, fn ($d) => $d->providerType === $providerType),
        );
    }

    /**
     * Returns a serializable snapshot of all registered providers.
     *
     * @return list<array<string,mixed>>
     */
    public function toArray(): array
    {
        return array_map(fn ($d) => $d->toArray(), array_values($this->definitions));
    }
}
