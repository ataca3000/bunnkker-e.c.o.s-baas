<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\System\Engineering\Domain\Enums\RepairFailureType;
use Modules\System\Engineering\Domain\Enums\RepairSessionStatus;
use Modules\System\Engineering\Domain\Models\RepairSession;

final class RepairSessionManager
{
    public function __construct(
        private readonly RetryPolicyEngine   $retryPolicyEngine,
        private readonly RepairAuditService  $auditService,
    ) {}

    public function create(
        string  $companyId,
        string  $sourceType,
        ?string $sourceId,
        string  $failureType,
        string  $failureSummary,
        array   $failureContext = [],
    ): RepairSession {
        $type       = RepairFailureType::from($failureType);
        $maxRetries = $this->retryPolicyEngine->getDefaultMaxRetries($failureType);

        $session = RepairSession::create([
            'company_id'       => $companyId,
            'source_type'      => $sourceType,
            'source_id'        => $sourceId,
            'status'           => RepairSessionStatus::Pending,
            'failure_type'     => $type,
            'failure_summary'  => $failureSummary,
            'failure_context'  => empty($failureContext) ? null : $failureContext,
            'retry_count'      => 0,
            'max_retries'      => $maxRetries,
            'timeout_seconds'  => 300,
            'timeout_at'       => now()->addSeconds(300),
        ]);

        $this->auditService->record($session, 'session.created', null, [
            'source_type'  => $sourceType,
            'failure_type' => $type->value,
        ]);

        return $session;
    }

    public function transition(
        RepairSession       $session,
        RepairSessionStatus $nextStatus,
        ?string             $actorId = null,
    ): void {
        if (! $session->status->canTransitionTo($nextStatus)) {
            throw new \RuntimeException(
                "Cannot transition from {$session->status->value} to {$nextStatus->value}"
            );
        }

        $update = ['status' => $nextStatus];

        if ($nextStatus === RepairSessionStatus::Analyzing) {
            $update['started_at'] = now();
        }

        if (
            $nextStatus === RepairSessionStatus::Completed
            || $nextStatus === RepairSessionStatus::Failed
        ) {
            $update['completed_at'] = now();
        }

        $session->update($update);

        $this->auditService->record($session, 'status.changed', $actorId, [
            'from' => $session->getOriginal('status'),
            'to'   => $nextStatus->value,
        ]);
    }

    public function checkTimeout(RepairSession $session): bool
    {
        return $session->isTimedOut() && ! $session->isTerminal();
    }

    public function enforceTimeout(RepairSession $session): bool
    {
        if (! $this->checkTimeout($session)) {
            return false;
        }

        $session->update([
            'status'       => RepairSessionStatus::Timeout,
            'completed_at' => now(),
            'failed_reason' => 'Session exceeded maximum allowed time.',
        ]);

        $this->auditService->record($session, 'session.timeout');

        return true;
    }

    public function list(string $companyId, array $filters = []): LengthAwarePaginator
    {
        $query = RepairSession::where('company_id', $companyId)
            ->with('analysis')
            ->orderByDesc('created_at');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['failure_type'])) {
            $query->where('failure_type', $filters['failure_type']);
        }

        if (! empty($filters['search'])) {
            $query->where('failure_summary', 'like', '%' . $filters['search'] . '%');
        }

        return $query->paginate($filters['per_page'] ?? 15);
    }

    public function get(string $id, string $companyId): RepairSession
    {
        return RepairSession::with(['analysis', 'prompts', 'responses', 'patches', 'history'])
            ->where('company_id', $companyId)
            ->findOrFail($id);
    }

    public function delete(RepairSession $session): void
    {
        $session->delete();

        $this->auditService->record($session, 'session.deleted');
    }
}
