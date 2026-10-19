<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Application\Queries;

use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

final class GetSupplierSummaryStatsQuery
{
    /**
     * Global KPI aggregates across all suppliers — used for the workspace header cards.
     *
     * @return array<string, mixed>
     */
    public function execute(): array
    {
        $totalSuppliers = Supplier::query()->count();
        $activeSuppliers = Supplier::query()->where('is_active', true)->count();

        $newThisMonth = Supplier::query()
            ->whereYear('created_at', now()->year)
            ->whereMonth('created_at', now()->month)
            ->count();

        $openPos = PurchaseOrder::query()
            ->whereIn('status', ['approved', 'partially_received'])
            ->whereNull('deleted_at')
            ->count();

        $delayedPos = PurchaseOrder::query()
            ->whereIn('status', ['approved', 'partially_received'])
            ->whereNotNull('expected_date')
            ->where('expected_date', '<', now()->toDateString())
            ->whereNull('deleted_at')
            ->count();

        $financials = GoodsReceipt::query()
            ->where('status', GoodsReceiptStatus::Posted->value)
            ->whereNull('deleted_at')
            ->selectRaw('
                COALESCE(SUM(invoice_total_amount), 0) as total_invoiced,
                COALESCE(SUM(paid_amount), 0)          as total_paid
            ')
            ->first();

        $totalInvoiced = (float) ($financials?->total_invoiced ?? 0);
        $totalPaid = (float) ($financials?->total_paid ?? 0);
        $totalOutstanding = max(0.0, $totalInvoiced - $totalPaid);

        $totalInventoryValue = (float) (InventoryReceiptLayer::query()
            ->where('remaining_qty', '>', 0)
            ->whereNotNull('supplier_id')
            ->selectRaw('COALESCE(SUM(remaining_qty * landed_unit_cost), 0) as total_value')
            ->value('total_value') ?? 0);

        $needsReviewCount = Supplier::query()
            ->where('is_active', true)
            ->whereNotIn('id', function ($q): void {
                $q->select('supplier_id')
                    ->from('purchase_orders')
                    ->where('created_at', '>=', now()->subDays(90))
                    ->whereNull('deleted_at');
            })
            ->count();

        return [
            'total_suppliers' => $totalSuppliers,
            'active_suppliers' => $activeSuppliers,
            'new_this_month' => $newThisMonth,
            'open_pos_total' => $openPos,
            'delayed_pos' => $delayedPos,
            'total_outstanding' => round($totalOutstanding, 2),
            'total_inventory_value' => round($totalInventoryValue, 2),
            'needs_review_count' => $needsReviewCount,
        ];
    }
}
