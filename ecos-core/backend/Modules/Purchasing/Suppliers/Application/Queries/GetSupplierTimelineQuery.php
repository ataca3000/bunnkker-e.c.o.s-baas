<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Application\Queries;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\Suppliers\Domain\Exceptions\SupplierNotFoundException;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * Chronological audit timeline for a supplier.
 * Unions events from multiple tables ordered by most recent first.
 */
final class GetSupplierTimelineQuery
{
    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function execute(string $supplierId, int $limit = 100): Collection
    {
        $supplier = Supplier::query()->find($supplierId);
        if ($supplier === null) {
            throw new SupplierNotFoundException($supplierId);
        }

        // ── Events from suppliers table ───────────────────────────────────────
        $supplierEvents = DB::table('suppliers')
            ->where('id', $supplierId)
            ->selectRaw("
                id                                           AS id,
                'supplier_created'                          AS event_type,
                'Supplier Created'                          AS title,
                name                                         AS description,
                CAST(NULL AS CHAR)                           AS reference,
                CAST(NULL AS CHAR)                           AS actor,
                created_at                                   AS occurred_at
            ");

        // ── Events from purchase_orders ────────────────────────────────────────
        $poEvents = DB::table('purchase_orders')
            ->where('supplier_id', $supplierId)
            ->whereNull('deleted_at')
            ->selectRaw("
                id                                           AS id,
                'po_created'                                AS event_type,
                'Purchase Order Created'                    AS title,
                po_number                                    AS description,
                po_number                                    AS reference,
                created_by                                   AS actor,
                created_at                                   AS occurred_at
            ")
            ->unionAll(
                DB::table('purchase_orders')
                    ->where('supplier_id', $supplierId)
                    ->whereNotNull('approved_at')
                    ->whereNull('deleted_at')
                    ->selectRaw("
                        id,
                        'po_approved',
                        'Purchase Order Approved',
                        po_number,
                        po_number,
                        approved_by,
                        approved_at
                    "),
            );

        // ── Events from goods_receipts (via purchase_orders) ─────────────────
        $grEvents = DB::table('goods_receipts as gr')
            ->join('purchase_orders as po', 'gr.purchase_order_id', '=', 'po.id')
            ->where('po.supplier_id', $supplierId)
            ->where('gr.status', GoodsReceiptStatus::Posted->value)
            ->whereNull('gr.deleted_at')
            ->selectRaw("
                gr.id                                       AS id,
                'gr_posted'                                 AS event_type,
                'Goods Receipt Posted'                      AS title,
                gr.receipt_number                           AS description,
                gr.receipt_number                           AS reference,
                gr.posted_by                                AS actor,
                COALESCE(gr.posted_at, gr.created_at)      AS occurred_at
            ");

        // Union all and order
        $allEvents = $supplierEvents
            ->unionAll($poEvents)
            ->unionAll($grEvents);

        $rows = DB::table(DB::raw("({$allEvents->toSql()}) as timeline_events"))
            ->mergeBindings($allEvents)
            ->orderByDesc('occurred_at')
            ->limit($limit)
            ->get();

        return $rows->map(fn (object $r): array => [
            'id' => $r->id,
            'type' => $r->event_type,
            'title' => $r->title,
            'description' => $r->description,
            'reference' => $r->reference,
            'actor' => $r->actor,
            'occurred_at' => $r->occurred_at,
        ]);
    }
}
