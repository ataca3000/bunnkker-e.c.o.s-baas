<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Application\Services;

/**
 * Answers capability questions about providers without hardcoded checks.
 *
 * All capability data lives in ProviderRegistry definitions — this engine
 * provides a convenient query API over it.
 *
 * Replace every `if ($provider === 'meta')` with:
 *   if ($this->engine->supports($providerKey, ProviderCapability::ADS))
 */
final class ProviderCapabilityEngine
{
    public function __construct(
        private readonly ProviderRegistry $registry,
    ) {}

    /**
     * Whether the given provider supports a specific capability.
     */
    public function supports(string $providerKey, string $capability): bool
    {
        return $this->registry->resolve($providerKey)?->supports($capability) ?? false;
    }

    /**
     * All capabilities declared by the given provider.
     *
     * @return list<string>
     */
    public function capabilitiesOf(string $providerKey): array
    {
        return $this->registry->resolve($providerKey)?->capabilities ?? [];
    }

    /**
     * Provider keys that expose the given capability.
     *
     * @return list<string>
     */
    public function providersWithCapability(string $capability): array
    {
        return array_map(
            fn ($d) => $d->providerKey,
            $this->registry->findByCapability($capability),
        );
    }

    /**
     * Whether any registered provider supports the capability.
     */
    public function anyProviderSupports(string $capability): bool
    {
        return count($this->registry->findByCapability($capability)) > 0;
    }

    /**
     * Capabilities shared by ALL of the given providers.
     *
     * @param  list<string>  $providerKeys
     * @return list<string>
     */
    public function commonCapabilities(array $providerKeys): array
    {
        if (empty($providerKeys)) {
            return [];
        }

        $sets = array_map(
            fn ($key) => $this->capabilitiesOf($key),
            $providerKeys,
        );

        return array_values(array_intersect(...$sets));
    }
}
