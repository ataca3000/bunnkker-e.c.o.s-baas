<?php

declare(strict_types=1);

namespace Modules\Operations\OrderLifecycle\Application\Services;

use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleRequest;
use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleResult;
use Modules\Operations\OrderLifecycle\Domain\Contracts\LifecycleHandlerInterface;

/**
 * Order Lifecycle Coordinator — the single integration point between
 * the Orders domain and all operational domains.
 *
 * ARCHITECTURE (handler plugin pattern):
 *   The coordinator is domain-agnostic. It holds a list of registered handlers
 *   and dispatches each lifecycle event to the first handler that supports it.
 *   Adding a new integration (Shipping, Accounting, CRM) requires only:
 *     1. Implementing LifecycleHandlerInterface
 *     2. Registering the handler in OrderLifecycleServiceProvider
 *     — The coordinator itself is never modified.
 *
 * COORDINATION FLOW:
 *   For each OrderLifecycleRequest, iterate handlers in registration order.
 *   The first handler whose supports() returns true processes the event.
 *   If no handler matches, StatusIgnored is returned.
 *
 * CONTRACT — this coordinator MUST NOT:
 *   - Import or call ManufacturingPolicy
 *   - Import or call ManufacturingApplicationService
 *   - Import or call any domain-specific service
 *   - Contain any business eligibility logic
 *   - Know which domains are registered (only LifecycleHandlerInterface)
 */
final class OrderLifecycleCoordinator
{
    /**
     * @param  list<LifecycleHandlerInterface>  $handlers  Registered in priority order.
     */
    public function __construct(
        private readonly array $handlers,
    ) {}

    /**
     * Handle an order lifecycle event for a single order line.
     *
     * Dispatches to the first handler that supports the event.
     * Always returns an OrderLifecycleResult — never throws for business outcomes.
     * Exceptions from infrastructure (DB errors, etc.) propagate unchanged.
     */
    public function handle(OrderLifecycleRequest $request): OrderLifecycleResult
    {
        foreach ($this->handlers as $handler) {
            if ($handler->supports($request)) {
                return $handler->handle($request);
            }
        }

        return OrderLifecycleResult::statusIgnored(
            orderId: $request->order_id,
            orderLineId: $request->order_line_id,
            reason: "No lifecycle handler supports order status '{$request->order_status}'.",
            metadata: $request->metadata,
        );
    }
}
