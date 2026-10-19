<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Events;

use Modules\Commerce\Orders\Domain\Models\OrderFinancialSnapshot;

/**
 * Fired immediately after OrderFinancialSnapshotCreated, confirming the snapshot
 * is fully written and immutably locked. Accounting OS listens to this event
 * to begin journal entry creation (ADR-020, PART 12).
 */
final class OrderFinancialSnapshotLocked
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

    public readonly ?string $integrityHash;

    public readonly string $lockedAt;

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
        $this->integrityHash = $snapshot->integrity_hash;
        $this->lockedAt = $snapshot->locked_at?->toIso8601String()
            ?? $snapshot->created_at?->toIso8601String()
            ?? now()->toIso8601String();
    }
}
