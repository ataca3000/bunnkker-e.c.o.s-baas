<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Marketing\CampaignStudio\Domain\Models\GovernancePolicy;

class GovernancePolicyService
{
    public function list(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return GovernancePolicy::where('is_active', true)
            ->when($filters['company_id'] ?? null, fn ($q, $id) => $q->where(fn ($q) => $q->where('company_id', $id)->orWhereNull('company_id')))
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->paginate($perPage);
    }

    public function create(array $data, string $userId): GovernancePolicy
    {
        if (($data['is_default'] ?? false) && isset($data['company_id'])) {
            GovernancePolicy::where('company_id', $data['company_id'])
                ->update(['is_default' => false]);
        }

        return GovernancePolicy::create(array_merge($data, [
            'created_by' => $userId,
            'updated_by' => $userId,
        ]));
    }

    public function update(GovernancePolicy $policy, array $data, string $userId): GovernancePolicy
    {
        if (($data['is_default'] ?? false) && $policy->company_id) {
            GovernancePolicy::where('company_id', $policy->company_id)
                ->where('id', '!=', $policy->id)
                ->update(['is_default' => false]);
        }

        $policy->update(array_merge($data, ['updated_by' => $userId]));

        return $policy->fresh();
    }

    public function delete(GovernancePolicy $policy): void
    {
        $policy->update(['is_active' => false]);
    }

    public function getForDraft(string $companyId): ?GovernancePolicy
    {
        return GovernancePolicy::where('is_active', true)
            ->where(fn ($q) => $q->where('company_id', $companyId)->orWhereNull('company_id'))
            ->where('is_default', true)
            ->orderBy('company_id', 'desc')
            ->first();
    }
}
