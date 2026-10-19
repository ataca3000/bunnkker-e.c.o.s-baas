<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Infrastructure\Registry;

use Illuminate\Contracts\Foundation\Application;
use Modules\System\Engineering\Domain\Contracts\PipelineProviderInterface;
use RuntimeException;

/**
 * Resolves the active CI provider from config.
 * Providers are registered in config/engineering.php under 'providers'.
 */
final class ProviderRegistry
{
    /** @var array<string, PipelineProviderInterface> */
    private array $resolved = [];

    public function __construct(private readonly Application $app) {}

    public function active(): PipelineProviderInterface
    {
        return $this->get(config('engineering.ci_provider', 'github'));
    }

    public function get(string $name): PipelineProviderInterface
    {
        if (isset($this->resolved[$name])) {
            return $this->resolved[$name];
        }

        $config = config("engineering.providers.{$name}");

        if ($config === null) {
            throw new RuntimeException("Engineering: unknown CI provider '{$name}'. Check config/engineering.php.");
        }

        $class = $config['class'] ?? null;

        if (! class_exists($class)) {
            throw new RuntimeException("Engineering: CI provider class '{$class}' not found.");
        }

        $provider = $this->app->make($class);

        if (! $provider instanceof PipelineProviderInterface) {
            throw new RuntimeException("Engineering: '{$class}' must implement PipelineProviderInterface.");
        }

        return $this->resolved[$name] = $provider;
    }

    /** Register a custom provider at runtime (useful for testing). */
    public function register(PipelineProviderInterface $provider): void
    {
        $this->resolved[$provider->name()] = $provider;
    }
}
