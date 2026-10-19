<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Query surface for the User Workspace (ADR-040): global search + advanced filters +
 * pagination. Read-only; all mutations go through the platform services.
 */
class UserRepository
{
    /**
     * @param  array<string,mixed>  $filters
     */
    public function search(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return $this->query($filters)->orderByDesc('created_at')->paginate($perPage);
    }

    /**
     * @param  array<string,mixed>  $filters
     */
    public function query(array $filters = []): Builder
    {
        $query = User::query()->with(['templateAssignments.template', 'organizationAssignments']);

        if (! empty($filters['q'])) {
            $term = '%'.$filters['q'].'%';
            $query->where(function (Builder $q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('display_name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('username', 'like', $term)
                    ->orWhere('employee_number', 'like', $term)
                    ->orWhere('phone', 'like', $term)
                    ->orWhere('job_title', 'like', $term);
            });
        }

        if (! empty($filters['status'])) {
            $query->whereIn('status', (array) $filters['status']);
        }
        if (! empty($filters['company_id'])) {
            $query->where('company_id', $filters['company_id']);
        }
        if (! empty($filters['template'])) {
            $key = $filters['template'];
            $query->whereHas('templateAssignments.template', fn (Builder $q) => $q->where('key', $key));
        }
        if (! empty($filters['org_type']) && ! empty($filters['org_id'])) {
            $query->whereHas('organizationAssignments', fn (Builder $q) => $q
                ->where('org_type', $filters['org_type'])
                ->where('org_id', $filters['org_id']));
        }
        if (array_key_exists('with_trashed', $filters) && $filters['with_trashed']) {
            $query->withTrashed();
        }

        return $query;
    }
}
