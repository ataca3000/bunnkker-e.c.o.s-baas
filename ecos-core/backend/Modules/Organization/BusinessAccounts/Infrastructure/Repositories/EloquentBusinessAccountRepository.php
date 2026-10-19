<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Organization\BusinessAccounts\Domain\Contracts\BusinessAccountRepositoryInterface;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;

final class EloquentBusinessAccountRepository implements BusinessAccountRepositoryInterface
{
    private const SORTABLE = ['code', 'name', 'provider', 'status', 'created_at', 'updated_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = BusinessAccount::query()->with(['company', 'brand']);

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->where('company_id', $companyId);
        }

        $brandId = trim((string) ($filters['brand_id'] ?? ''));
        if ($brandId !== '') {
            $query->where('brand_id', $brandId);
        }

        $provider = trim((string) ($filters['provider'] ?? ''));
        if ($provider !== '') {
            $query->where('provider', $provider);
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $b) use ($search): void {
                $b->where('code', 'ilike', "%{$search}%")
                    ->orWhere('name', 'ilike', "%{$search}%");
            });
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min((int) ($filters['per_page'] ?? 10), 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?BusinessAccount
    {
        return BusinessAccount::query()->with(['company', 'brand'])->find($id);
    }

    public function create(array $attributes): BusinessAccount
    {
        return BusinessAccount::query()->create($attributes)->load(['company', 'brand']);
    }

    public function update(BusinessAccount $account, array $attributes): BusinessAccount
    {
        $account->update($attributes);

        return $account->load(['company', 'brand']);
    }

    public function delete(BusinessAccount $account): void
    {
        $account->delete();
    }

    public function nextCodeNumber(string $companyId): int
    {
        $count = BusinessAccount::query()
            ->withTrashed()
            ->where('company_id', $companyId)
            ->lockForUpdate()
            ->count();

        return $count + 1;
    }
}
