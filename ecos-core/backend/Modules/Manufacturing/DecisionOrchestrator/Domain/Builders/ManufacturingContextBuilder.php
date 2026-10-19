<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Domain\Builders;

use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\ContextBuilderInterface;

/**
 * Builds a DecisionContext for manufacturing decisions.
 *
 * Expected parameters:
 *   product_id          string   — UUID of the finished-good product
 *   ordered_qty         float    — Gross quantity requested by the order
 *   available_qty       float    — Finished goods currently in stock
 *   shortage_qty        float    — max(0, ordered_qty - available_qty)  [RC-1]
 *
 * Optional parameters:
 *   branch_id           string   — Branch requesting manufacturing
 *   warehouse_id        string   — Target warehouse for finished goods
 *   allow_partial       bool     — Whether caller accepts a PARTIAL decision
 *
 * After building, the Orchestrator enriches the context with recipe metadata
 * (recipe_id, bom_version_number, component_count) before kernel evaluation.
 *
 * Note: `shortage_qty` is the caller's responsibility to compute using RC-1:
 *   shortage_qty = max(0, ordered_qty - available_qty)
 * This builder does not enforce the formula — it is already the caller's job.
 */
final class ManufacturingContextBuilder implements ContextBuilderInterface
{
    public function contextType(): string
    {
        return 'manufacturing';
    }

    public function requiresRecipe(): bool
    {
        return true;
    }

    /** @param  array<string, mixed>  $parameters */
    public function build(array $parameters): DecisionContext
    {
        $context = new DecisionContext($this->contextType());

        // ── Required fields ───────────────────────────────────────────────────
        $context = $context
            ->with('product_id', (string) ($parameters['product_id'] ?? ''))
            ->with('ordered_qty', (float) ($parameters['ordered_qty'] ?? 0.0))
            ->with('available_qty', (float) ($parameters['available_qty'] ?? 0.0))
            ->with('shortage_qty', (float) ($parameters['shortage_qty'] ?? 0.0));

        // ── Optional fields ───────────────────────────────────────────────────
        if (isset($parameters['branch_id'])) {
            $context = $context->with('branch_id', (string) $parameters['branch_id']);
        }

        if (isset($parameters['warehouse_id'])) {
            $context = $context->with('warehouse_id', (string) $parameters['warehouse_id']);
        }

        if (isset($parameters['allow_partial'])) {
            $context = $context->with('allow_partial', (bool) $parameters['allow_partial']);
        }

        return $context;
    }
}
