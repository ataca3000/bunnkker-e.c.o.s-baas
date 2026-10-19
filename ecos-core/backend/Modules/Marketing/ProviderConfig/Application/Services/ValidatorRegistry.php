<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Application\Services;

use Modules\Marketing\ProviderConfig\Contracts\ProviderValidatorInterface;

/**
 * Holds per-provider validator instances.
 *
 * Populated in ProviderConfigServiceProvider — every validator is registered
 * once at boot. Validators are looked up by provider key at runtime.
 */
final class ValidatorRegistry
{
    /** @var array<string, ProviderValidatorInterface> */
    private array $validators = [];

    public function register(string $provider, ProviderValidatorInterface $validator): void
    {
        $this->validators[$provider] = $validator;
    }

    public function get(string $provider): ?ProviderValidatorInterface
    {
        return $this->validators[$provider] ?? null;
    }

    public function has(string $provider): bool
    {
        return isset($this->validators[$provider]);
    }

    /** @return list<string> */
    public function supported(): array
    {
        return array_keys($this->validators);
    }
}
