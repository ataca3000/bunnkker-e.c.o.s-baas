<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\ValueObjects;

use Modules\Marketing\ProviderPlatform\Domain\Enums\ProviderCapability;

/**
 * Immutable descriptor for a registered provider.
 *
 * Created once at boot in ProviderPlatformServiceProvider and stored in
 * ProviderRegistry.  No mutable state.
 */
final class ProviderDefinition
{
    /**
     * @param  list<string>  $capabilities  ProviderCapability::* constants
     */
    public function __construct(
        public readonly string $providerKey,
        public readonly string $displayName,
        public readonly string $providerType,
        public readonly string $version,
        public readonly array $capabilities,
        public readonly ?string $documentationUrl = null,
        public readonly ?string $logoUrl = null,
    ) {}

    public function supports(string $capability): bool
    {
        return in_array($capability, $this->capabilities, true);
    }

    public function toArray(): array
    {
        return [
            'provider_key' => $this->providerKey,
            'display_name' => $this->displayName,
            'provider_type' => $this->providerType,
            'version' => $this->version,
            'capabilities' => $this->capabilities,
            'documentation_url' => $this->documentationUrl,
            'logo_url' => $this->logoUrl,
        ];
    }
}
