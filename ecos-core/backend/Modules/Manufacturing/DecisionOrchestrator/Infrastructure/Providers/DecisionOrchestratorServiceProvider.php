<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeResolverInterface;
use Modules\Manufacturing\DecisionKernel\Domain\Services\DecisionKernel;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\RuleProviderRegistryInterface;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Services\DecisionOrchestrator;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Services\InMemoryRuleProviderRegistry;

/**
 * Registers the Decision Orchestrator and its Registry.
 *
 * RuleProviderRegistryInterface is bound as a singleton so callers can register
 * providers at boot time (e.g. in their own ServiceProvider) and those registrations
 * are shared across the request lifecycle.
 *
 * DecisionOrchestrator is also a singleton — it is stateless and thread-safe.
 */
final class DecisionOrchestratorServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            RuleProviderRegistryInterface::class,
            InMemoryRuleProviderRegistry::class,
        );

        $this->app->singleton(DecisionOrchestrator::class, function ($app): DecisionOrchestrator {
            return new DecisionOrchestrator(
                resolver: $app->make(RecipeResolverInterface::class),
                kernel: $app->make(DecisionKernel::class),
                registry: $app->make(RuleProviderRegistryInterface::class),
            );
        });
    }
}
