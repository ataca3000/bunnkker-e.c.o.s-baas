<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Automation\Domain\Models\AutomationGovernancePolicy;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use RuntimeException;

class AutomationGovernanceService
{
    public function list(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return AutomationGovernancePolicy::query()
            ->when($filters['company_id'] ?? null, fn ($q, $v) => $q->where('company_id', $v))
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->paginate($perPage);
    }

    public function create(array $data, string $userId): AutomationGovernancePolicy
    {
        if ($data['is_default'] ?? false) {
            AutomationGovernancePolicy::where('company_id', $data['company_id'] ?? null)->update(['is_default' => false]);
        }

        return AutomationGovernancePolicy::create(array_merge($data, [
            'created_by' => $userId,
            'updated_by' => $userId,
        ]));
    }

    public function update(AutomationGovernancePolicy $policy, array $data, string $userId): AutomationGovernancePolicy
    {
        $policy->update(array_merge($data, ['updated_by' => $userId]));

        return $policy->fresh();
    }

    public function delete(AutomationGovernancePolicy $policy): void
    {
        $policy->update(['is_active' => false]);
    }

    public function getForWorkflow(AutomationWorkflow $workflow): ?AutomationGovernancePolicy
    {
        if ($workflow->governance_policy_id) {
            return AutomationGovernancePolicy::find($workflow->governance_policy_id);
        }

        return AutomationGovernancePolicy::where('company_id', $workflow->company_id)
            ->where('is_default', true)
            ->where('is_active', true)
            ->first();
    }

    /** Throw an exception if this entity has hit governance limits. */
    public function assertCanExecute(AutomationWorkflow $workflow, string $entityType, string $entityId): void
    {
        $policy = $this->getForWorkflow($workflow);
        if (! $policy) {
            return; // no policy = no limits
        }

        // Quiet hours check
        if ($policy->isInQuietHours()) {
            throw new RuntimeException('Execution blocked: quiet hours policy active.');
        }

        // Per-customer-per-day limit
        if ($limit = $policy->max_executions_per_customer_per_day) {
            $count = DB::table('automation_workflow_executions')
                ->where('entity_type', $entityType)
                ->where('entity_id', $entityId)
                ->whereDate('created_at', today())
                ->count();

            if ($count >= $limit) {
                throw new RuntimeException("Execution blocked: customer daily limit ({$limit}) reached.");
            }
        }

        // Per-customer-per-workflow limit
        if ($limit = $policy->max_executions_per_customer_per_workflow) {
            $count = DB::table('automation_workflow_executions')
                ->where('workflow_id', $workflow->id)
                ->where('entity_type', $entityType)
                ->where('entity_id', $entityId)
                ->count();

            if ($count >= $limit) {
                throw new RuntimeException("Execution blocked: customer-workflow limit ({$limit}) reached.");
            }
        }

        // Global daily total limit
        if ($limit = $policy->max_total_executions_per_day) {
            $count = DB::table('automation_workflow_executions')
                ->where('workflow_id', $workflow->id)
                ->whereDate('created_at', today())
                ->count();

            if ($count >= $limit) {
                throw new RuntimeException("Execution blocked: daily total limit ({$limit}) reached.");
            }
        }
    }
}
