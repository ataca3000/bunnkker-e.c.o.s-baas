<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Events;

use Modules\Commerce\Orders\Domain\Models\OrderFinancialSnapshot;

/**
 * Fired when the immutable financial snapshot is first persisted for an order.
 *
 * The denormalized payload is designed for direct consumption by Accounting OS
 * and BI pipelines without needing to re-query the snapshot table (ADR-020, PART 12).
 */
final class OrderFinancialSnapshotCreated
{
    public readonly string $snapshotUuid;

    public readonly int $snapshotVersion;

    public readonly string $orderId;

    public readonly ?string $companyId;

    public readonly ?string $brandId;

    public readonly ?string $channelId;

    public readonly ?string $channelName;

    public readonly float $grandTotal;

    public readonly ?float $grossProfit;

    public readonly ?float $actualMarginPercent;

    public readonly ?string $marginStatus;

    public readonly ?string $integrityHash;

    public readonly string $createdAt;

    public function __construct(public readonly OrderFinancialSnapshot $snapshot)
    {
        $this->snapshotUuid = $snapshot->snapshot_uuid;
        $this->snapshotVersion = $snapshot->snapshot_version;
        $this->orderId = $snapshot->order_id;
        $this->companyId = $snapshot->company_id;
        $this->brandId = $snapshot->brand_id;
        $this->channelId = $snapshot->channel_id;
        $this->channelName = $snapshot->channel_name;
        $this->grandTotal = $snapshot->grand_total;
        $this->grossProfit = $snapshot->gross_profit;
        $this->actualMarginPercent = $snapshot->actual_margin_percent;
        $this->marginStatus = $snapshot->margin_status;
        $this->integrityHash = $snapshot->integrity_hash;
        $this->createdAt = $snapshot->created_at?->toIso8601String() ?? now()->toIso8601String();
    }
}
