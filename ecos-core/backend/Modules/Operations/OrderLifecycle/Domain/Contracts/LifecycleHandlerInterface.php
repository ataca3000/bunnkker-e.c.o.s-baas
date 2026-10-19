<?php

declare(strict_types=1);

namespace Modules\Operations\OrderLifecycle\Domain\Contracts;

use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleRequest;
use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleResult;

/**
 * Contract for lifecycle handlers that plug into OrderLifecycleCoordinator.
 *
 * Each handler owns exactly one integration domain (Manufacturing, Shipping, etc.).
 * The coordinator never calls domain services directly — it only dispatches to handlers.
 *
 * ADDING A NEW INTEGRATION:
 *   1. Implement this interface.
 *   2. Register the handler in OrderLifecycleServiceProvider.
 *   3. Do NOT modify OrderLifecycleCoordinator.
 */
interface LifecycleHandlerInterface
{
    /**
     * True when this handler should process the given lifecycle request.
     *
     * Called before handle(). Keep fast — no I/O, no DB queries.
     */
    public function supports(OrderLifecycleRequest $request): bool;

    /**
     * Process the lifecycle event and return a typed result.
     *
     * MUST NOT throw for business outcomes; only infrastructure exceptions propagate.
     */
    public function handle(OrderLifecycleRequest $request): OrderLifecycleResult;
}
