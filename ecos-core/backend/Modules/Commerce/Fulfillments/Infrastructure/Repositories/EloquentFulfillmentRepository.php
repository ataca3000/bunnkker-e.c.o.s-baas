<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Commerce\Fulfillments\Domain\Contracts\FulfillmentRepositoryInterface;
use Modules\Commerce\Fulfillments\Domain\Models\Fulfillment;

final class EloquentFulfillmentRepository implements FulfillmentRepositoryInterface
{
    private const SORTABLE = ['fulfillment_number', 'fulfillment_date', 'status', 'created_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Fulfillment::query()->with(['order.customer', 'warehouse', 'lines.product']);

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('fulfillment_number', 'like', "%{$search}%")
                    ->orWhereHas('order', function (Builder $q) use ($search): void {
                        $q->where('order_number', 'like', "%{$search}%");
                    });
            });
        }

        $orderId = trim((string) ($filters['order_id'] ?? ''));
        if ($orderId !== '') {
            $query->where('order_id', $orderId);
        }

        $warehouseId = trim((string) ($filters['warehouse_id'] ?? ''));
        if ($warehouseId !== '') {
            $query->where('warehouse_id', $warehouseId);
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min((int) ($filters['per_page'] ?? 10), 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?Fulfillment
    {
        return Fulfillment::query()
            ->with(['order.customer', 'order.channel', 'warehouse', 'lines.product'])
            ->find($id);
    }

    public function create(array $attributes, array $lines): Fulfillment
    {
        $fulfillment = Fulfillment::query()->create($attributes);
        $fulfillment->lines()->createMany($lines);

        return $this->findById((string) $fulfillment->id) ?? $fulfillment;
    }

    public function update(Fulfillment $fulfillment, array $attributes, array $lines): Fulfillment
    {
        $fulfillment->update($attributes);
        $fulfillment->lines()->delete();
        $fulfillment->lines()->createMany($lines);

        return $this->findById((string) $fulfillment->id) ?? $fulfillment->refresh();
    }

    public function delete(Fulfillment $fulfillment): void
    {
        $fulfillment->delete();
    }

    public function nextFulfillmentNumber(): string
    {
        $last = Fulfillment::query()
            ->withTrashed()
            ->orderByRaw("CAST(REPLACE(fulfillment_number, 'FUL-', '') AS UNSIGNED) DESC")
            ->value('fulfillment_number');

        if ($last === null) {
            return 'FUL-00001';
        }

        $current = (int) str_replace('FUL-', '', (string) $last);

        return 'FUL-'.str_pad((string) ($current + 1), 5, '0', STR_PAD_LEFT);
    }
}
