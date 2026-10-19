<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Contracts;

use Modules\Common\Snapshots\Domain\DTOs\FinancialLineSnapshotDTO;

/**
 * Contract for aggregates that provide financial data for snapshot creation.
 *
 * Implementing classes are responsible for pre-computing line-level cost and
 * pricing data. The FinancialSnapshotBuilder only aggregates and derives
 * margin metrics — it never performs BOM lookups or price resolutions itself.
 */
interface FinancialSnapshotProvider extends IntegrityProvider, Snapshotable
{
    // ── Financial totals ──────────────────────────────────────────────────────

    public function getSubtotal(): float;

    public function getGrandTotal(): float;

    public function getDiscountAmount(): float;

    public function getDiscountType(): ?string;

    public function getShippingCost(): float;

    public function getDepositAmount(): float;

    public function getRemainingBalance(): float;

    public function getCurrency(): string;

    public function getPaymentMethod(): ?string;

    // ── Party identifiers ─────────────────────────────────────────────────────

    public function getCustomerId(): ?string;

    public function getCustomerName(): ?string;

    public function getBrandId(): ?string;

    public function getChannelId(): ?string;

    public function getChannelName(): ?string;

    // ── Shipping context ──────────────────────────────────────────────────────

    public function getShippingRuleId(): ?string;

    public function getShippingRuleName(): ?string;

    public function getShippingZone(): ?string;

    public function getShippingOverrideApplied(): bool;

    public function getShippingOverrideBy(): ?string;

    // ── Pre-computed line items ───────────────────────────────────────────────

    /** @return FinancialLineSnapshotDTO[] */
    public function getLineItems(): array;

    // ── Actor ─────────────────────────────────────────────────────────────────

    public function getSnapshotCreatedBy(): ?string;
}
