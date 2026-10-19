<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Purchasing\GoodsReceipts\Domain\Contracts\GoodsReceiptRepositoryInterface;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;

final class EloquentGoodsReceiptRepository implements GoodsReceiptRepositoryInterface
{
    private const SORTABLE = ['receipt_number', 'receipt_date', 'status', 'created_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = GoodsReceipt::query()->with(['purchaseOrder.supplier', 'warehouse', 'lines.product']);

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->where('company_id', $companyId);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('receipt_number', 'like', "%{$search}%")
                    ->orWhereHas('purchaseOrder', function (Builder $q) use ($search): void {
                        $q->where('po_number', 'like', "%{$search}%");
                    });
            });
        }

        $poId = trim((string) ($filters['purchase_order_id'] ?? ''));
        if ($poId !== '') {
            $query->where('purchase_order_id', $poId);
        }

        $warehouseId = trim((string) ($filters['warehouse_id'] ?? ''));
        if ($warehouseId !== '') {
            $query->where('warehouse_id', $warehouseId);
        }

        $supplierId = trim((string) ($filters['supplier_id'] ?? ''));
        if ($supplierId !== '') {
            $query->whereHas('purchaseOrder', function (Builder $q) use ($supplierId): void {
                $q->where('supplier_id', $supplierId);
            });
        }

        $paymentStatus = trim((string) ($filters['payment_status'] ?? ''));
        if ($paymentStatus !== '' && $paymentStatus !== 'all') {
            $query->where('payment_status', $paymentStatus);
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $dateFrom = trim((string) ($filters['date_from'] ?? ''));
        if ($dateFrom !== '') {
            $query->where('receipt_date', '>=', $dateFrom);
        }

        $dateTo = trim((string) ($filters['date_to'] ?? ''));
        if ($dateTo !== '') {
            $query->where('receipt_date', '<=', $dateTo);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        $perPage = max(1, min((int) ($filters['per_page'] ?? 10), 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?GoodsReceipt
    {
        return GoodsReceipt::query()->with(['purchaseOrder.lines.product', 'warehouse', 'lines.product'])->find($id);
    }

    public function create(array $attributes, array $lines): GoodsReceipt
    {
        $receipt = GoodsReceipt::query()->create($attributes);
        $receipt->lines()->createMany($lines);

        return $this->findById((string) $receipt->id) ?? $receipt;
    }

    public function update(GoodsReceipt $receipt, array $attributes, array $lines): GoodsReceipt
    {
        $receipt->update($attributes);
        $receipt->lines()->delete();
        $receipt->lines()->createMany($lines);

        return $this->findById((string) $receipt->id) ?? $receipt->refresh();
    }

    public function delete(GoodsReceipt $receipt): void
    {
        $receipt->delete();
    }

    public function nextReceiptNumber(): string
    {
        $last = GoodsReceipt::query()
            ->withTrashed()
            ->orderByRaw("CAST(REPLACE(receipt_number, 'GR-', '') AS UNSIGNED) DESC")
            ->value('receipt_number');

        if ($last === null) {
            return 'GR-00001';
        }

        $current = (int) str_replace('GR-', '', (string) $last);

        return 'GR-'.str_pad((string) ($current + 1), 5, '0', STR_PAD_LEFT);
    }
}
