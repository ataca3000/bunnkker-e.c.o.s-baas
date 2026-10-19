<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Application\Services;

use Modules\Marketing\Connections\Domain\Contracts\MarketingConnectorInterface;
use RuntimeException;

/**
 * Registry of all available marketing platform connectors.
 *
 * Connectors self-register via their service provider on boot.
 * The core Marketing Domain never references a specific connector class.
 */
final class ConnectorRegistry
{
    /** @var array<string, MarketingConnectorInterface> */
    private array $connectors = [];

    public function register(MarketingConnectorInterface $connector): void
    {
        $this->connectors[$connector->getType()] = $connector;
    }

    public function get(string $type): MarketingConnectorInterface
    {
        if (! isset($this->connectors[$type])) {
            throw new RuntimeException(
                "No connector registered for type '{$type}'. Available: ".implode(', ', array_keys($this->connectors)),
            );
        }

        return $this->connectors[$type];
    }

    /** @return array<string, MarketingConnectorInterface> */
    public function all(): array
    {
        return $this->connectors;
    }

    public function has(string $type): bool
    {
        return isset($this->connectors[$type]);
    }

    /** @return list<string> */
    public function types(): array
    {
        return array_keys($this->connectors);
    }

    /**
     * @return list<array{type: string, display_name: string, metadata: array<string, mixed>, capabilities: list<string>}>
     */
    public function summary(): array
    {
        return array_values(array_map(
            fn (MarketingConnectorInterface $c) => [
                'type' => $c->getType(),
                'display_name' => $c->getDisplayName(),
                'metadata' => $c->getProviderMetadata(),
                'capabilities' => $c->getCapabilities(),
            ],
            $this->connectors,
        ));
    }
}
