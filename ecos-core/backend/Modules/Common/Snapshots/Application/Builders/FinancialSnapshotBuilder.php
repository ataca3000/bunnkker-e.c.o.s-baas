<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Application\Builders;

use Closure;
use Illuminate\Support\Str;
use Modules\Common\Snapshots\Domain\Contracts\FinancialSnapshotProvider;
use Modules\Common\Snapshots\Domain\DTOs\FinancialLineSnapshotDTO;
use Modules\Common\Snapshots\Domain\DTOs\FinancialSnapshotDTO;
use Modules\Common\Snapshots\Domain\Engine\IntegrityEngine;

/**
 * Builds a FinancialSnapshotDTO from a FinancialSnapshotProvider.
 *
 * Responsibilities:
 *  - Aggregate cost totals from pre-computed line items
 *  - Compute gross profit, margin diagnostics, and margin status
 *  - Derive recipe version from line data
 *  - Compute SHA-256 integrity hash via IntegrityEngine
 *  - Assign snapshot UUID and version
 *
 * No Order-specific assumptions. Works for any aggregate that implements
 * FinancialSnapshotProvider (Orders, POS, Invoices, etc.).
 */
final class FinancialSnapshotBuilder
{
    private const MARGIN_TOLERANCE = 2.0;

    private const PRICING_ENGINE_VER = '1.0.0';

    private const COST_ENGINE_VER = '1.0.0';

    private const PRICING_POLICY_VER = '1.0.0';

    private const SHIPPING_POLICY_VER = '1.0.0';

    public function __construct(private readonly IntegrityEngine $integrityEngine) {}

    public function build(FinancialSnapshotProvider $provider): FinancialSnapshotDTO
    {
        $lines = $provider->getLineItems();

        // ── Aggregate cost totals ─────────────────────────────────────────────
        $totalCogs = $this->sumColumn($lines, fn ($l) => $l->lineCost);
        $totalRawMaterialCost = $this->sumColumn($lines, fn ($l) => $l->rawMaterialCost);
        $totalPackagingCost = $this->sumColumn($lines, fn ($l) => $l->packagingCost);
        $totalManufacturingCost = $this->sumColumn($lines, fn ($l) => $l->manufacturingCost);
        $totalOtherCost = $this->sumColumn($lines, fn ($l) => $l->otherCost);

        $totalCogs = $totalCogs > 0 ? round($totalCogs, 4) : null;
        $totalRawMaterialCost = $totalRawMaterialCost > 0 ? round($totalRawMaterialCost, 4) : null;
        $totalPackagingCost = $totalPackagingCost > 0 ? round($totalPackagingCost, 4) : null;
        $totalManufacturingCost = $totalManufacturingCost > 0 ? round($totalManufacturingCost, 4) : null;
        $totalOtherCost = $totalOtherCost > 0 ? round($totalOtherCost, 4) : null;

        $grossProfit = $totalCogs !== null
            ? round($provider->getGrandTotal() - $totalCogs, 4)
            : null;

        // ── Margin diagnostics ────────────────────────────────────────────────
        [$targetMarginPct, $actualMarginPct, $marginDiff, $marginStatus] =
            $this->computeMarginDiagnostics($provider, $lines, $totalCogs);

        // ── Recipe version ────────────────────────────────────────────────────
        $recipeVersion = $this->deriveRecipeVersion($lines);

        // ── Integrity hash ────────────────────────────────────────────────────
        $integrityHash = $this->integrityEngine->compute($provider->buildIntegrityCanonical());

        return new FinancialSnapshotDTO(
            aggregateId: $provider->getSnapshotAggregateId(),
            aggregateType: $provider->getSnapshotAggregateType(),
            snapshotUuid: Str::uuid()->toString(),
            snapshotVersion: 1,

            // Parties
            companyId: $provider->getSnapshotCompanyId(),
            brandId: $provider->getBrandId(),
            channelId: $provider->getChannelId(),
            channelName: $provider->getChannelName(),
            customerId: $provider->getCustomerId(),
            customerName: $provider->getCustomerName(),

            // Financials
            currency: $provider->getCurrency(),
            paymentMethod: $provider->getPaymentMethod(),
            subtotal: $provider->getSubtotal(),
            discountAmount: $provider->getDiscountAmount(),
            discountType: $provider->getDiscountType(),
            shippingCost: $provider->getShippingCost(),
            depositAmount: $provider->getDepositAmount(),
            remainingBalance: $provider->getRemainingBalance(),
            grandTotal: $provider->getGrandTotal(),

            // Shipping
            shippingRuleId: $provider->getShippingRuleId(),
            shippingRuleName: $provider->getShippingRuleName(),
            shippingZone: $provider->getShippingZone(),
            shippingOverrideApplied: $provider->getShippingOverrideApplied(),
            shippingOverrideBy: $provider->getShippingOverrideBy(),

            // Computed aggregates
            totalCogs: $totalCogs,
            grossProfit: $grossProfit,
            totalRawMaterialCost: $totalRawMaterialCost,
            totalPackagingCost: $totalPackagingCost,
            totalManufacturingCost: $totalManufacturingCost,
            totalOtherCost: $totalOtherCost,

            // Computed margin diagnostics
            targetMarginPercent: $targetMarginPct,
            actualMarginPercent: $actualMarginPct,
            marginDifference: $marginDiff,
            marginStatus: $marginStatus,

            // Engine metadata
            pricingEngineVersion: self::PRICING_ENGINE_VER,
            costEngineVersion: self::COST_ENGINE_VER,
            recipeVersion: $recipeVersion,
            brandPricingPolicyVersion: self::PRICING_POLICY_VER,
            shippingPricingVersion: self::SHIPPING_POLICY_VER,

            // Integrity
            integrityHash: $integrityHash,

            // Lines
            lines: $lines,
        );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Sum a nullable float column from line DTOs, returning 0 if all are null.
     *
     * @param  FinancialLineSnapshotDTO[]  $lines
     */
    private function sumColumn(array $lines, Closure $getter): float
    {
        return array_reduce($lines, static function (float $carry, FinancialLineSnapshotDTO $l) use ($getter): float {
            $val = $getter($l);

            return $carry + ($val ?? 0.0);
        }, 0.0);
    }

    /**
     * @param  FinancialLineSnapshotDTO[]  $lines
     * @return array{float|null, float|null, float|null, string|null}
     */
    private function computeMarginDiagnostics(FinancialSnapshotProvider $provider, array $lines, ?float $totalCogs): array
    {
        $actualMarginPct = null;
        $targetMarginPct = null;
        $marginDiff = null;
        $marginStatus = null;

        if ($totalCogs !== null && $provider->getGrandTotal() > 0.0) {
            $actualMarginPct = round(
                (($provider->getGrandTotal() - $totalCogs) / $provider->getGrandTotal()) * 100.0,
                4,
            );
        }

        // Weighted-average target margin (weight = line_total)
        $weightedSum = 0.0;
        $totalWeight = 0.0;
        foreach ($lines as $line) {
            if ($line->lineTotal > 0.0) {
                $weightedSum += $line->targetMarginPercent * $line->lineTotal;
                $totalWeight += $line->lineTotal;
            }
        }

        if ($totalWeight > 0.0) {
            $targetMarginPct = round($weightedSum / $totalWeight, 4);
        }

        if ($actualMarginPct !== null && $targetMarginPct !== null) {
            $marginDiff = round($actualMarginPct - $targetMarginPct, 4);
            $marginStatus = $this->deriveMarginStatus($actualMarginPct, $targetMarginPct);
        }

        return [$targetMarginPct, $actualMarginPct, $marginDiff, $marginStatus];
    }

    private function deriveMarginStatus(?float $actual, float $target): ?string
    {
        if ($actual === null) {
            return null;
        }

        $diff = $actual - $target;

        if (abs($diff) <= self::MARGIN_TOLERANCE) {
            return 'within_target';
        }

        return $diff < 0 ? 'below_target' : 'above_target';
    }

    /** @param FinancialLineSnapshotDTO[] $lines */
    private function deriveRecipeVersion(array $lines): ?string
    {
        $versions = array_filter(array_map(
            static fn (FinancialLineSnapshotDTO $l) => $l->sourceRecipeVersion,
            $lines,
        ));

        $unique = array_unique($versions);

        if (count($unique) === 0) {
            return null;
        }

        return count($unique) === 1 ? array_values($unique)[0] : 'multiple';
    }
}
