<?php

namespace Modules\System\Engineering\Application\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Enums\RepairSessionStatus;
use Modules\System\Engineering\Domain\Models\RepairRetryPolicy;
use Modules\System\Engineering\Domain\Models\RepairSession;

class RetryPolicyEngine
{
    public function getPolicy(string $companyId, string $failureType): ?RepairRetryPolicy
    {
        return RepairRetryPolicy::where('company_id', $companyId)
            ->where('is_active', true)
            ->where(function ($query) use ($failureType) {
                $query->where('failure_type', $failureType)
                      ->orWhere('failure_type', 'all');
            })
            ->orderByRaw('CASE WHEN failure_type = ? THEN 0 ELSE 1 END', [$failureType])
            ->first();
    }

    public function shouldRetry(RepairSession $session): bool
    {
        return $session->retry_count < $session->max_retries
            && ! $session->isTimedOut();
    }

    public function getNextRetryAt(RepairSession $session, RepairRetryPolicy $policy): Carbon
    {
        $delay = $policy->retry_delay_seconds * ($policy->backoff_multiplier ** $session->retry_count);

        return now()->addSeconds((int) $delay);
    }

    public function executeRetry(RepairSession $session): bool
    {
        if (! $this->shouldRetry($session)) {
            return false;
        }

        $session->update([
            'status'      => RepairSessionStatus::Retrying,
            'retry_count' => $session->retry_count + 1,
        ]);

        return true;
    }

    public function getDefaultMaxRetries(string $failureType): int
    {
        return match ($failureType) {
            'build_failure', 'test_failure', 'pipeline_failure' => 3,
            'security_issue', 'architecture_violation'          => 1,
            default                                             => 2,
        };
    }
}
