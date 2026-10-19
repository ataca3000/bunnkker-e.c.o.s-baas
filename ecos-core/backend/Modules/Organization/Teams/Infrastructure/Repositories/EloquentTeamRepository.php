<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Organization\Teams\Domain\Contracts\TeamRepositoryInterface;
use Modules\Organization\Teams\Domain\Models\Team;

final class EloquentTeamRepository implements TeamRepositoryInterface
{
    private const SORTABLE = ['code', 'name', 'leader_name', 'is_active', 'created_at', 'updated_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Team::query()->with('company');

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->where('company_id', $companyId);
        }

        $status = (string) ($filters['status'] ?? 'all');
        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
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

    public function findById(string $id): ?Team
    {
        return Team::query()->with('company')->find($id);
    }

    public function create(array $attributes): Team
    {
        return Team::query()->create($attributes)->load('company');
    }

    public function update(Team $team, array $attributes): Team
    {
        $team->update($attributes);

        return $team->load('company');
    }

    public function delete(Team $team): void
    {
        $team->delete();
    }

    public function nextCodeNumber(string $companyId): int
    {
        $count = Team::query()
            ->withTrashed()
            ->where('company_id', $companyId)
            ->lockForUpdate()
            ->count();

        return $count + 1;
    }
}
