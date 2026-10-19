<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Domain\Services;

use Modules\Manufacturing\DecisionKernel\Domain\Contracts\RuleProviderInterface;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\RuleProviderRegistryInterface;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Exceptions\NoProviderForContextException;

/**
 * In-memory registry mapping context types to RuleProviders.
 *
 * Callers register providers before orchestration:
 *
 *   $registry
 *       ->register('manufacturing', new InMemoryRuleProvider($r1, $r2))
 *       ->register('goods_receipt', new InMemoryRuleProvider($r3));
 *
 * When a provider source requires external data (DB, AI), implement
 * RuleProviderRegistryInterface with a different backing store — no
 * changes to the Orchestrator are needed.
 */
final class InMemoryRuleProviderRegistry implements RuleProviderRegistryInterface
{
    /** @var array<string, RuleProviderInterface> */
    private array $providers = [];

    public function register(string $contextType, RuleProviderInterface $provider): static
    {
        $this->providers[$contextType] = $provider;

        return $this;
    }

    /** @throws NoProviderForContextException */
    public function for(string $contextType): RuleProviderInterface
    {
        return $this->providers[$contextType]
            ?? throw NoProviderForContextException::forContext($contextType);
    }

    public function has(string $contextType): bool
    {
        return isset($this->providers[$contextType]);
    }
}
