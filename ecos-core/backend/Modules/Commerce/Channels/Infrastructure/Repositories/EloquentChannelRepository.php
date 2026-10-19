<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Commerce\Channels\Domain\Contracts\ChannelRepositoryInterface;
use Modules\Commerce\Channels\Domain\Models\Channel;

final class EloquentChannelRepository implements ChannelRepositoryInterface
{
    private const SORTABLE = ['name', 'platform', 'is_active', 'last_sync_at', 'created_at'];

    private const EAGER = ['brand.company', 'businessAccount'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Channel::query()->with(self::EAGER);

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('name', 'ilike', "%{$search}%")
                    ->orWhere('store_url', 'ilike', "%{$search}%");
            });
        }

        $status = (string) ($filters['status'] ?? 'all');
        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $platform = trim((string) ($filters['platform'] ?? ''));
        if ($platform !== '') {
            $query->where('platform', $platform);
        }

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->whereHas('brand', fn (Builder $b) => $b->where('company_id', $companyId));
        }

        $brandId = trim((string) ($filters['brand_id'] ?? ''));
        if ($brandId !== '') {
            $query->where('brand_id', $brandId);
        }

        $businessAccountId = trim((string) ($filters['business_account_id'] ?? ''));
        if ($businessAccountId !== '') {
            $query->where('business_account_id', $businessAccountId);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min((int) ($filters['per_page'] ?? 10), 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?Channel
    {
        return Channel::query()->with(self::EAGER)->find($id);
    }

    public function create(array $attributes, ?array $credentials): Channel
    {
        $channel = Channel::query()->create($attributes);

        if ($credentials !== null) {
            $channel->credential()->create($credentials);
        }

        return $channel->refresh()->load(self::EAGER);
    }

    public function update(Channel $channel, array $attributes, ?array $credentials): Channel
    {
        $channel->update($attributes);

        if ($credentials !== null) {
            $channel->credential()->updateOrCreate([], $credentials);
        }

        return $channel->refresh()->load(self::EAGER);
    }

    public function delete(Channel $channel): void
    {
        $channel->delete();
    }
}
