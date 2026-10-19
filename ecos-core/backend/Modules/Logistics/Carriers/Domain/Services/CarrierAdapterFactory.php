<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Domain\Services;

use Modules\Logistics\Carriers\Domain\Contracts\CarrierAdapterInterface;
use Modules\Logistics\Carriers\Domain\Exceptions\CarrierException;
use Modules\Logistics\Carriers\Domain\Models\CarrierAccount;

/**
 * Resolves an account to its adapter.
 *
 * ┌─ DIRECTIVE 9 — THE ONE PLACE CARRIERS ARE NAMED ────────────────────────┐
 * │ Adapters register themselves here by key. The core asks the factory for  │
 * │ an account's adapter and calls the interface — it never branches on a    │
 * │ carrier name.                                                            │
 * │                                                                          │
 * │ Onboarding carrier #16 is: implement the interface in its own folder,    │
 * │ register it, configure the account. Nothing else changes.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CarrierAdapterFactory
{
    /** @var array<string, CarrierAdapterInterface> */
    private array $adapters = [];

    /** @param iterable<CarrierAdapterInterface> $adapters */
    public function __construct(iterable $adapters = [])
    {
        foreach ($adapters as $adapter) {
            $this->register($adapter);
        }
    }

    public function register(CarrierAdapterInterface $adapter): void
    {
        $this->adapters[$adapter->key()] = $adapter;
    }

    public function has(string $key): bool
    {
        return isset($this->adapters[$key]);
    }

    /**
     * The adapter for an account.
     *
     * Throws rather than falling back: silently substituting a different
     * carrier's adapter would send a shipment to the wrong place.
     */
    public function for(CarrierAccount $account): CarrierAdapterInterface
    {
        $adapter = $this->adapters[$account->adapter_key] ?? null;

        if ($adapter === null) {
            throw CarrierException::unknownAdapter($account->adapter_key);
        }

        return $adapter;
    }

    public function get(string $key): ?CarrierAdapterInterface
    {
        return $this->adapters[$key] ?? null;
    }

    /** @return list<CarrierAdapterInterface> */
    public function all(): array
    {
        return array_values($this->adapters);
    }

    /** @return list<array{key: string, name: string}> */
    public function catalogue(): array
    {
        return array_map(
            static fn (CarrierAdapterInterface $a) => [
                'key' => $a->key(),
                'name' => $a->displayName(),
            ],
            $this->all(),
        );
    }
}
