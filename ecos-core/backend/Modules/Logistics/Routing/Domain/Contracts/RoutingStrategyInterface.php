<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Contracts;

use Modules\Logistics\Routing\Domain\ValueObjects\RouteProposal;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteRequest;

/**
 * ┌─ DIRECTIVE 10 — ROUTING IS A STRATEGY ──────────────────────────────────┐
 * │                                                                          │
 * │ PURITY CONTRACT. An implementation MUST NOT:                             │
 * │   • read a repository, a cache, or the database                          │
 * │   • read the clock                                                       │
 * │   • emit an event or write anything                                      │
 * │   • depend on the identity of the caller                                 │
 * │                                                                          │
 * │ Everything it needs is in RouteRequest. Everything it produces is in     │
 * │ RouteProposal. Same input, same output, always.                          │
 * │                                                                          │
 * │ That is what makes a run replayable, lets two strategies be compared     │
 * │ fairly on recorded snapshots, and makes a future AI optimiser a NEW      │
 * │ IMPLEMENTATION rather than a redesign. Phase 2 ships deterministic       │
 * │ strategies only — no optimisation AI.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
interface RoutingStrategyInterface
{
    /** Stable identifier used in policy, persisted on every plan and run. */
    public function name(): string;

    /**
     * Bumped when the algorithm changes in a way that would alter output for
     * the same input — without it, a replay silently compares apples to pears.
     */
    public function version(): string;

    /** Human-readable, for the strategy picker. */
    public function description(): string;

    /**
     * Whether this strategy can handle the given request.
     *
     * Returning false is NORMAL, not an error: a geometric strategy cannot work
     * without coordinates, and the resolver simply falls through to the next
     * candidate. A misconfigured policy therefore degrades rather than fails.
     */
    public function supports(RouteRequest $request): bool;

    public function optimize(RouteRequest $request): RouteProposal;
}
