<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Domain\Builders;

use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\ContextBuilderInterface;

/**
 * Builds a DecisionContext for goods receipt decisions.
 *
 * GR decisions do not involve recipes — the decision is based on quantity
 * variance, supplier performance, and PO compliance.
 *
 * Expected parameters:
 *   gr_id               string   — UUID of the goods receipt
 *   purchase_order_id   string   — UUID of the related purchase order
 *   received_qty        float    — Quantity physically received
 *   ordered_qty         float    — Quantity expected per the PO
 *   supplier_id         string   — UUID of the supplier
 *
 * Optional parameters:
 *   variance_pct        float    — abs(received - ordered) / ordered * 100
 *   is_partial          bool     — True when received_qty < ordered_qty
 *   over_received       bool     — True when received_qty > ordered_qty
 *
 * Rules typically evaluate:
 *   - variance_pct > threshold → REJECT or ESCALATE
 *   - variance_pct within tolerance → APPROVE
 *   - is_partial = true → DEFER (await remaining shipment)
 */
final class GoodsReceiptContextBuilder implements ContextBuilderInterface
{
    public function contextType(): string
    {
        return 'goods_receipt';
    }

    public function requiresRecipe(): bool
    {
        return false;
    }

    /** @param  array<string, mixed>  $parameters */
    public function build(array $parameters): DecisionContext
    {
        $receivedQty = (float) ($parameters['received_qty'] ?? 0.0);
        $orderedQty = (float) ($parameters['ordered_qty'] ?? 0.0);

        $variancePct = $orderedQty > 0.0
            ? round(abs($receivedQty - $orderedQty) / $orderedQty * 100.0, 4)
            : 0.0;

        $context = (new DecisionContext($this->contextType()))
            ->with('gr_id', (string) ($parameters['gr_id'] ?? ''))
            ->with('purchase_order_id', (string) ($parameters['purchase_order_id'] ?? ''))
            ->with('received_qty', $receivedQty)
            ->with('ordered_qty', $orderedQty)
            ->with('supplier_id', (string) ($parameters['supplier_id'] ?? ''))
            ->with('variance_pct', $parameters['variance_pct'] ?? $variancePct)
            ->with('is_partial', $receivedQty < $orderedQty)
            ->with('over_received', $receivedQty > $orderedQty);

        return $context;
    }
}
