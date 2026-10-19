<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Adapters;

use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Common\Snapshots\Domain\Contracts\FinancialSnapshotProvider;
use Modules\Common\Snapshots\Domain\Contracts\IntegrityProvider;
use Modules\Common\Snapshots\Domain\DTOs\FinancialLineSnapshotDTO;
use Modules\Sales\ShippingPricing\Domain\Models\ShippingPricingRule;
use Modules\Sales\ShippingPricing\Domain\Scopes\CompanyScope;

/**
 * Orders implementation of FinancialSnapshotProvider + IntegrityProvider.
 *
 * Pre-computed $lineData arrays (from CreateOrderSnapshotService::buildLineData())
 * are converted to FinancialLineSnapshotDTO objects here. The platform builder
 * only aggregates — all Order-specific calculations happen upstream.
 */
final class OrderFinancialSnapshotAdapter implements FinancialSnapshotProvider, IntegrityProvider
{
    /** @var FinancialLineSnapshotDTO[]|null Lazy-converted from arrays. */
    private ?array $lineDTOs = null;

    /** @var array{string|null, string|null, string|null, bool}|null Lazy-resolved shipping snapshot. */
    private ?array $shippingSnapshot = null;

    public function __construct(
        private readonly Order $order,
        private readonly array $lineData,
        private readonly ?string $companyId,
        private readonly ?string $actorId,
    ) {}

    // ── Snapshotable ──────────────────────────────────────────────────────────

    public function getSnapshotAggregateId(): string
    {
        return $this->order->id;
    }

    public function getSnapshotAggregateType(): string
    {
        return 'order';
    }

    public function getSnapshotCompanyId(): ?string
    {
        return $this->companyId;
    }

    // ── Financial totals ──────────────────────────────────────────────────────

    public function getSubtotal(): float
    {
        return (float) ($this->order->subtotal ?? 0);
    }

    public function getGrandTotal(): float
    {
        return (float) $this->order->total;
    }

    public function getDiscountAmount(): float
    {
        return (float) ($this->order->discount_amount ?? 0);
    }

    public function getDiscountType(): ?string
    {
        return $this->order->discount_type;
    }

    public function getShippingCost(): float
    {
        return (float) ($this->order->shipping_cost ?? 0);
    }

    public function getDepositAmount(): float
    {
        return (float) ($this->order->deposit_amount ?? 0);
    }

    public function getRemainingBalance(): float
    {
        return (float) ($this->order->remaining_balance ?? 0);
    }

    public function getCurrency(): string
    {
        return 'EGP';
    }

    public function getPaymentMethod(): ?string
    {
        return $this->order->payment_method_manual ?? $this->order->payment_method;
    }

    // ── Party identifiers ─────────────────────────────────────────────────────

    public function getCustomerId(): ?string
    {
        return $this->order->customer_id;
    }

    public function getCustomerName(): ?string
    {
        return $this->order->customer?->name;
    }

    public function getBrandId(): ?string
    {
        return $this->order->channel?->brand_id ?? null;
    }

    public function getChannelId(): ?string
    {
        return $this->order->channel_id;
    }

    public function getChannelName(): ?string
    {
        return $this->order->channel?->name;
    }

    // ── Shipping context ──────────────────────────────────────────────────────

    public function getShippingRuleId(): ?string
    {
        return $this->resolveShippingSnapshot()[0];
    }

    public function getShippingRuleName(): ?string
    {
        return $this->resolveShippingSnapshot()[1];
    }

    public function getShippingZone(): ?string
    {
        return $this->resolveShippingSnapshot()[2];
    }

    public function getShippingOverrideApplied(): bool
    {
        return $this->resolveShippingSnapshot()[3];
    }

    public function getShippingOverrideBy(): ?string
    {
        return $this->resolveShippingSnapshot()[3] ? $this->actorId : null;
    }

    // ── Pre-computed line items ───────────────────────────────────────────────

    /** @return FinancialLineSnapshotDTO[] */
    public function getLineItems(): array
    {
        if ($this->lineDTOs === null) {
            $this->lineDTOs = array_map(
                fn (array $ld) => $this->toLineDTO($ld),
                $this->lineData,
            );
        }

        return $this->lineDTOs;
    }

    // ── Actor ─────────────────────────────────────────────────────────────────

    public function getSnapshotCreatedBy(): ?string
    {
        return $this->actorId;
    }

    // ── IntegrityProvider ─────────────────────────────────────────────────────

    /**
     * Canonical string for SHA-256 integrity hash.
     * Must match exactly the string used by verifyIntegrityHash() in CreateOrderSnapshotService.
     */
    public function buildIntegrityCanonical(): string
    {
        $lineParts = array_map(
            static fn (array $ld) => implode(':', [
                $ld['product_id'] ?? '',
                number_format((float) ($ld['quantity'] ?? 0), 4, '.', ''),
                number_format((float) ($ld['unit_price_at_sale'] ?? 0), 4, '.', ''),
                number_format((float) ($ld['line_total'] ?? 0), 4, '.', ''),
            ]),
            $this->lineData,
        );

        usort($lineParts, static fn ($a, $b) => strcmp($a, $b));

        return implode('|', [
            $this->order->id,
            number_format((float) $this->order->total, 4, '.', ''),
            number_format((float) $this->order->subtotal, 4, '.', ''),
            number_format((float) ($this->order->discount_amount ?? 0), 4, '.', ''),
            number_format((float) ($this->order->shipping_cost ?? 0), 4, '.', ''),
            implode(',', $lineParts),
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function toLineDTO(array $ld): FinancialLineSnapshotDTO
    {
        return new FinancialLineSnapshotDTO(
            aggregateId: $this->order->id,
            sourceLineId: $ld['order_line_id'] ?? null,
            productId: $ld['product_id'] ?? null,
            productSku: $ld['product_sku'] ?? null,
            productName: $ld['product_name'] ?? null,
            quantity: (float) ($ld['quantity'] ?? 0),
            unitPriceAtSale: (float) ($ld['unit_price_at_sale'] ?? 0),
            regularPriceAtSale: isset($ld['regular_price_at_sale']) ? (float) $ld['regular_price_at_sale'] : null,
            salePriceAtSale: isset($ld['sale_price_at_sale']) ? (float) $ld['sale_price_at_sale'] : null,
            lineTotal: (float) ($ld['line_total'] ?? 0),
            rawMaterialCost: isset($ld['raw_material_cost']) ? (float) $ld['raw_material_cost'] : null,
            packagingCost: isset($ld['packaging_cost']) ? (float) $ld['packaging_cost'] : null,
            manufacturingCost: isset($ld['manufacturing_cost']) ? (float) $ld['manufacturing_cost'] : null,
            otherCost: isset($ld['other_cost']) ? (float) $ld['other_cost'] : null,
            recipeCost: isset($ld['recipe_cost']) ? (float) $ld['recipe_cost'] : null,
            unitCost: isset($ld['unit_cost']) ? (float) $ld['unit_cost'] : null,
            lineCost: isset($ld['line_cost']) ? (float) $ld['line_cost'] : null,
            targetMarginPercent: (float) ($ld['target_margin_percent'] ?? 30.0),
            bomId: $ld['bom_id'] ?? null,
            bomVersionNumber: isset($ld['bom_version_number']) ? (int) $ld['bom_version_number'] : null,
            sourceRecipeVersion: $ld['source_recipe_version'] ?? null,
            priceReviewId: $ld['price_review_id'] ?? null,
            priceReviewApprovedAt: $ld['price_review_approved_at'] ?? null,
            priceReviewApprovedBy: $ld['price_review_approved_by'] ?? null,
            costSnapshot: $ld['cost_snapshot'] ?? null,
        );
    }

    /** @return array{string|null, string|null, string|null, bool} */
    private function resolveShippingSnapshot(): array
    {
        if ($this->shippingSnapshot !== null) {
            return $this->shippingSnapshot;
        }

        $zone = implode(' › ', array_filter([$this->order->governorate, $this->order->area])) ?: null;
        $overrideApplied = $this->order->shipping_cost_source === 'override';
        $ruleId = null;
        $ruleName = null;

        if (! $overrideApplied && $this->order->governorate) {
            $rule = ShippingPricingRule::withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $this->companyId)
                ->where('governorate', $this->order->governorate)
                ->when($this->order->area, fn ($q) => $q->where('area', $this->order->area))
                ->where('is_active', true)
                ->first()
                ?? ShippingPricingRule::withoutGlobalScope(CompanyScope::class)
                    ->where('company_id', $this->companyId)
                    ->where('governorate', $this->order->governorate)
                    ->whereNull('area')
                    ->where('is_active', true)
                    ->first();

            if ($rule) {
                $ruleId = $rule->id;
                $ruleName = implode(' › ', array_filter([$rule->governorate, $rule->city, $rule->area]));
            }
        }

        return $this->shippingSnapshot = [$ruleId, $ruleName, $zone, $overrideApplied];
    }
}
