<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Purchasing\PurchaseOrders\Domain\Contracts\PurchaseOrderRepositoryInterface;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;

final class EloquentPurchaseOrderRepository implements PurchaseOrderRepositoryInterface
{
    private const SORTABLE = ['po_number', 'order_date', 'expected_date', 'status', 'total', 'created_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = PurchaseOrder::query()->with(['supplier', 'warehouse', 'lines.product']);

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->where('company_id', $companyId);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('po_number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', function (Builder $s) use ($search): void {
                        $s->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $supplierId = trim((string) ($filters['supplier_id'] ?? ''));
        if ($supplierId !== '') {
            $query->where('supplier_id', $supplierId);
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $dateFrom = trim((string) ($filters['date_from'] ?? ''));
        if ($dateFrom !== '') {
            $query->where('order_date', '>=', $dateFrom);
        }

        $dateTo = trim((string) ($filters['date_to'] ?? ''));
        if ($dateTo !== '') {
            $query->where('order_date', '<=', $dateTo);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        $perPage = (int) ($filters['per_page'] ?? 10);
        $perPage = max(1, min($perPage, 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?PurchaseOrder
    {
        return PurchaseOrder::query()->with(['supplier', 'warehouse', 'lines.product'])->find($id);
    }

    public function create(array $attributes, array $lines): PurchaseOrder
    {
        $order = PurchaseOrder::query()->create($attributes);
        $order->lines()->createMany($lines);

        return $this->findById((string) $order->id) ?? $order;
    }

    public function update(PurchaseOrder $order, array $attributes, array $lines): PurchaseOrder
    {
        $order->update($attributes);
        $order->lines()->delete();
        $order->lines()->createMany($lines);

        return $this->findById((string) $order->id) ?? $order->refresh();
    }

    public function delete(PurchaseOrder $order): void
    {
        $order->delete();
    }

    public function nextPoNumber(): string
    {
        $last = PurchaseOrder::query()
            ->withTrashed()
            ->orderByRaw("CAST(REPLACE(po_number, 'PO-', '') AS UNSIGNED) DESC")
            ->value('po_number');

        if ($last === null) {
            return 'PO-00001';
        }

        $current = (int) str_replace('PO-', '', (string) $last);

        return 'PO-'.str_pad((string) ($current + 1), 5, '0', STR_PAD_LEFT);
    }
}
