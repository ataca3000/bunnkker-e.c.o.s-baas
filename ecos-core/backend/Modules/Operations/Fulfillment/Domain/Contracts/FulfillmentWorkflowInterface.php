<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Contracts;

use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;

/**
 * Every fulfillment workflow implements this contract.
 *
 * The FulfillmentEngine calls them in order:
 *   guard()   → called OUTSIDE the transaction (fast rejection)
 *   execute() → called INSIDE DB::transaction()
 *   events()  → called AFTER transaction commits (gets result)
 */
interface FulfillmentWorkflowInterface
{
    /**
     * Validate preconditions. Throw WorkflowPreconditionException if not met.
     * Must NOT write to the database.
     */
    public function guard(FulfillmentContext $ctx): void;

    /**
     * Execute the workflow. Called inside an open DB::transaction.
     * Must NOT open its own outer transaction (nested transactions are allowed).
     */
    public function execute(FulfillmentContext $ctx): FulfillmentResult;

    /**
     * Return domain events to dispatch after the transaction commits.
     *
     * @return list<object>
     */
    public function events(FulfillmentResult $result): array;

    /** Human-readable name for audit trail. */
    public function name(): string;
}
