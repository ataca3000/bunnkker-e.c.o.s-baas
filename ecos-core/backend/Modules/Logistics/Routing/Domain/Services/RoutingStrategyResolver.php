<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Services;

use Modules\Logistics\Routing\Domain\Contracts\RoutingStrategyInterface;
use Modules\Logistics\Routing\Domain\Strategies\SequentialZoneStrategy;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteRequest;

/**
 * Picks a strategy from POLICY, never from a hardcoded branch.
 *
 * Resolution order: explicit per-request override → company/area policy →
 * configured default → SequentialZoneStrategy.
 *
 * A strategy whose supports() returns false for the given request is SKIPPED
 * and the chain continues, so a misconfigured policy degrades to a working
 * baseline instead of failing. Adding the future AI strategy means registering
 * one more implementation here — no existing code changes.
 */
class RoutingStrategyResolver
{
    /** @var array<string, RoutingStrategyInterface> */
    private array $strategies = [];

    /** @param iterable<RoutingStrategyInterface> $strategies */
    public function __construct(iterable $strategies = [])
    {
        foreach ($strategies as $strategy) {
            $this->register($strategy);
        }
    }

    public function register(RoutingStrategyInterface $strategy): void
    {
        $this->strategies[$strategy->name()] = $strategy;
    }

    public function has(string $name): bool
    {
        return isset($this->strategies[$name]);
    }

    public function get(string $name): ?RoutingStrategyInterface
    {
        return $this->strategies[$name] ?? null;
    }

    /** @return list<RoutingStrategyInterface> */
    public function all(): array
    {
        return array_values($this->strategies);
    }

    /**
     * @return list<array{name: string, version: string, description: string}>
     */
    public function catalogue(): array
    {
        return array_map(
            static fn (RoutingStrategyInterface $s) => [
                'name' => $s->name(),
                'version' => $s->version(),
                'description' => $s->description(),
            ],
            $this->all(),
        );
    }

    /**
     * The strategy that will actually run.
     *
     * Never returns null — the fallback is guaranteed to support any request,
     * which is exactly why SequentialZoneStrategy::supports() is hardcoded true.
     */
    public function resolve(RouteRequest $request, ?string $preferred = null): RoutingStrategyInterface
    {
        foreach ($this->candidateNames($preferred) as $name) {
            $strategy = $this->strategies[$name] ?? null;

            if ($strategy !== null && $strategy->supports($request)) {
                return $strategy;
            }
        }

        return $this->fallback();
    }

    /** @return list<string> */
    private function candidateNames(?string $preferred): array
    {
        $names = [];

        if ($preferred !== null) {
            $names[] = $preferred;
        }

        $configured = config('logistics.routing.default_strategy');

        if (is_string($configured) && $configured !== '') {
            $names[] = $configured;
        }

        return $names;
    }

    private function fallback(): RoutingStrategyInterface
    {
        return $this->strategies[(new SequentialZoneStrategy)->name()]
            ?? new SequentialZoneStrategy;
    }
}
