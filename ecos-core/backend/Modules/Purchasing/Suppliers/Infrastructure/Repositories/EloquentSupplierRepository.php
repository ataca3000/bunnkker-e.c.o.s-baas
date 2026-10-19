<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Modules\Purchasing\Suppliers\Domain\Contracts\SupplierRepositoryInterface;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * Eloquent implementation of the supplier repository.
 */
final class EloquentSupplierRepository implements SupplierRepositoryInterface
{
    /** Columns that may be sorted on (whitelist). */
    private const SORTABLE = ['code', 'name', 'country', 'city', 'is_active', 'created_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Supplier::query()->select('suppliers.*');

        // ── Aggregate subqueries (LEFT JOIN on derived tables) ────────────────

        $grStats = DB::table('goods_receipts')
            ->join('purchase_orders', 'goods_receipts.purchase_order_id', '=', 'purchase_orders.id')
            ->where('goods_receipts.status', 'posted')
            ->whereNull('goods_receipts.deleted_at')
            ->whereNull('purchase_orders.deleted_at')
            ->selectRaw('
                purchase_orders.supplier_id,
                COALESCE(SUM(goods_receipts.invoice_total_amount), 0) AS total_invoiced,
                COALESCE(SUM(goods_receipts.paid_amount), 0)          AS total_paid,
                MAX(goods_receipts.receipt_date)                       AS last_purchase_date,
                COUNT(goods_receipts.id)                               AS purchase_count
            ')
            ->groupBy('purchase_orders.supplier_id');

        $poStats = DB::table('purchase_orders')
            ->whereIn('status', ['approved', 'partially_received'])
            ->whereNull('deleted_at')
            ->selectRaw('supplier_id, COUNT(*) AS active_pos_count')
            ->groupBy('supplier_id');

        $invStats = DB::table('inventory_receipt_layers')
            ->where('remaining_qty', '>', 0)
            ->selectRaw('
                supplier_id,
                COALESCE(SUM(remaining_qty * landed_unit_cost), 0) AS inventory_cost_value
            ')
            ->groupBy('supplier_id');

        $query->leftJoinSub($grStats, 'gr_agg', fn ($j) => $j->on('suppliers.id', '=', 'gr_agg.supplier_id'));
        $query->leftJoinSub($poStats, 'po_agg', fn ($j) => $j->on('suppliers.id', '=', 'po_agg.supplier_id'));
        $query->leftJoinSub($invStats, 'inv_agg', fn ($j) => $j->on('suppliers.id', '=', 'inv_agg.supplier_id'));

        $query->addSelect([
            DB::raw('COALESCE(gr_agg.total_invoiced, 0)                          AS total_invoiced'),
            DB::raw('COALESCE(gr_agg.total_paid, 0)                              AS total_paid'),
            DB::raw('GREATEST(0, COALESCE(gr_agg.total_invoiced, 0) - COALESCE(gr_agg.total_paid, 0)) AS outstanding_balance'),
            DB::raw('gr_agg.last_purchase_date'),
            DB::raw('COALESCE(po_agg.active_pos_count, 0)                        AS active_pos_count'),
            DB::raw('COALESCE(inv_agg.inventory_cost_value, 0)                   AS inventory_cost_value'),
        ]);

        // ── Filters ───────────────────────────────────────────────────────────

        $country = trim((string) ($filters['country'] ?? ''));
        if ($country !== '') {
            $query->where('suppliers.country', $country);
        }

        $city = trim((string) ($filters['city'] ?? ''));
        if ($city !== '') {
            $query->where('suppliers.city', $city);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('suppliers.code', 'like', "%{$search}%")
                    ->orWhere('suppliers.name', 'like', "%{$search}%")
                    ->orWhere('suppliers.contact_person', 'like', "%{$search}%")
                    ->orWhere('suppliers.email', 'like', "%{$search}%")
                    ->orWhere('suppliers.city', 'like', "%{$search}%");
            });
        }

        $status = (string) ($filters['status'] ?? 'all');
        if ($status === 'active') {
            $query->where('suppliers.is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('suppliers.is_active', false);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        $perPage = (int) ($filters['per_page'] ?? 10);
        $perPage = max(1, min($perPage, 100));

        return $query->orderBy("suppliers.{$sortBy}", $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?Supplier
    {
        return Supplier::query()->find($id);
    }

    public function create(array $attributes): Supplier
    {
        return Supplier::query()->create($attributes);
    }

    public function update(Supplier $supplier, array $attributes): Supplier
    {
        $supplier->update($attributes);

        return $supplier->refresh();
    }

    public function delete(Supplier $supplier): void
    {
        $supplier->delete();
    }
}
