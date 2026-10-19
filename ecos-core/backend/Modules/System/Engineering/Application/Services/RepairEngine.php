<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\RepairSessionStatus;
use Modules\System\Engineering\Domain\Enums\ValidationVerdict;
use Modules\System\Engineering\Domain\Models\PatchValidation;
use Modules\System\Engineering\Domain\Models\RepairAnalysis;
use Modules\System\Engineering\Domain\Models\RepairPatch;
use Modules\System\Engineering\Domain\Models\RepairSession;

final class RepairEngine
{
    public function __construct(
        private readonly RepairSessionManager    $sessionManager,
        private readonly FailureAnalysisEngine   $analysisEngine,
        private readonly RepairPromptBuilder     $promptBuilder,
        private readonly ClaudeCodeIntegration   $claudeIntegration,
        private readonly RetryPolicyEngine       $retryPolicyEngine,
        private readonly RepairAuditService      $auditService,
    ) {}

    public function initiate(
        string  $companyId,
        string  $sourceType,
        ?string $sourceId,
        string  $failureType,
        string  $failureSummary,
        array   $context = [],
    ): RepairSession {
        return $this->sessionManager->create(
            $companyId,
            $sourceType,
            $sourceId,
            $failureType,
            $failureSummary,
            $context,
        );
    }

    public function analyze(RepairSession $session): RepairSession
    {
        $this->sessionManager->transition($session, RepairSessionStatus::Analyzing);

        $analysis = $this->analysisEngine->analyze($session);

        $session->update([
            'root_cause_category'    => $analysis->root_cause,
            'root_cause_description' => $this->buildDescription($session, $analysis),
        ]);

        $this->auditService->record($session, 'analysis.completed', null, [
            'root_cause'  => $analysis->root_cause,
            'confidence'  => $analysis->confidence,
            'approach'    => $analysis->approach,
        ]);

        return $session->fresh();
    }

    public function generatePrompt(RepairSession $session): array
    {
        $this->sessionManager->transition($session, RepairSessionStatus::GeneratingPrompt);

        $analysis = $session->analysis;

        if ($analysis === null) {
            throw new \RuntimeException('Session must be analyzed before generating a prompt');
        }

        $prompt = $this->promptBuilder->build($session, $analysis);

        $this->sessionManager->transition($session, RepairSessionStatus::AwaitingResponse);

        $package = $this->claudeIntegration->prepareClaudePackage($session, $prompt);

        $this->auditService->record($session, 'prompt.generated', null, [
            'prompt_id'      => $prompt->id ?? null,
            'version'        => $prompt->version ?? null,
            'token_estimate' => $prompt->token_estimate ?? null,
        ]);

        return $package;
    }

    public function submitResponse(
        RepairSession $session,
        string        $content,
        string        $responseType,
        ?string       $actorId = null,
    ): RepairSession {
        $activePrompt = $session->activePrompt;

        if ($activePrompt === null) {
            throw new \RuntimeException('No active prompt found for this session');
        }

        $response = $this->claudeIntegration->receiveResponse(
            $session,
            $activePrompt,
            $content,
            $responseType,
        );

        if ($response->response_type->isPatch()) {
            $this->claudeIntegration->extractPatch($response);
        }

        $this->auditService->record($session, 'response.received', $actorId, [
            'response_id' => $response->id,
            'type'        => $responseType,
        ]);

        return $session->fresh();
    }

    public function applyPatch(RepairSession $session, string $patchId, string $actorId): RepairSession
    {
        $patch = RepairPatch::where('session_id', $session->id)->findOrFail($patchId);

        // ENG-V2-002: Self-Healing Pipeline validation gate
        $latestValidation = PatchValidation::where('patch_id', $patch->id)
            ->orderByDesc('attempt_number')
            ->orderByDesc('created_at')
            ->first();

        if ($latestValidation && $latestValidation->verdict === ValidationVerdict::Rejected) {
            throw new \RuntimeException('Patch was rejected by the Self-Healing Pipeline and cannot be applied.');
        }

        if (config('engineering.self_healing.require_validation_before_apply', false)
            && (! $latestValidation || $latestValidation->verdict !== ValidationVerdict::Accepted)
        ) {
            throw new \RuntimeException('Patch must pass Self-Healing Pipeline validation before it can be applied.');
        }

        $this->sessionManager->transition($session, RepairSessionStatus::Applying, $actorId);

        // ENG-V2-002: capture rollback snapshot before applying
        app(PatchRollbackService::class)->snapshot($patch);

        $patch->update([
            'is_applied'          => true,
            'applied_at'          => now(),
            'applied_by'          => $actorId,
            'verification_status' => 'pending',
        ]);

        $this->auditService->record($session, 'patch.applied', $actorId, [
            'patch_id' => $patchId,
            'files'    => $patch->files ?? [],
        ]);

        return $session->fresh();
    }

    public function complete(RepairSession $session, ?string $actorId = null): RepairSession
    {
        $this->sessionManager->transition($session, RepairSessionStatus::Completed, $actorId);

        $this->auditService->recordMetric($session, 'repair', 'session_completed', 1.0);

        return $session->fresh();
    }

    public function fail(RepairSession $session, string $reason, ?string $actorId = null): RepairSession
    {
        $session->update(['failed_reason' => $reason]);

        $this->sessionManager->transition($session, RepairSessionStatus::Failed, $actorId);

        $this->auditService->record($session, 'session.failed', $actorId, [
            'reason' => $reason,
        ]);

        return $session->fresh();
    }

    public function cancel(RepairSession $session, ?string $actorId = null): RepairSession
    {
        $this->sessionManager->transition($session, RepairSessionStatus::Cancelled, $actorId);

        $this->auditService->record($session, 'session.cancelled', $actorId);

        return $session->fresh();
    }

    public function retry(RepairSession $session): bool
    {
        if (! $this->retryPolicyEngine->shouldRetry($session)) {
            return false;
        }

        $retried = $this->retryPolicyEngine->executeRetry($session);

        if ($retried) {
            $this->auditService->record($session, 'session.retry_scheduled', null, [
                'retry_count' => $session->retry_count,
            ]);
        }

        return $retried;
    }

    /** @return array<string, mixed> */
    public function getDashboard(string $companyId): array
    {
        $terminalStatuses = RepairSessionStatus::terminalValues();
        $today            = now()->startOfDay();

        $totalSessions = RepairSession::where('company_id', $companyId)->count();

        $activeSessions = RepairSession::where('company_id', $companyId)
            ->whereNotIn('status', $terminalStatuses)
            ->count();

        $completedToday = RepairSession::where('company_id', $companyId)
            ->where('status', RepairSessionStatus::Completed)
            ->where('completed_at', '>=', $today)
            ->count();

        $failedToday = RepairSession::where('company_id', $companyId)
            ->where('status', RepairSessionStatus::Failed)
            ->where('completed_at', '>=', $today)
            ->count();

        $denominator  = $completedToday + $failedToday;
        $successRate  = $denominator > 0
            ? round(($completedToday / $denominator) * 100, 1)
            : 0;

        $recentSessions = RepairSession::where('company_id', $companyId)
            ->with('analysis')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        $byFailureType = RepairSession::where('company_id', $companyId)
            ->selectRaw('failure_type, COUNT(*) as count')
            ->groupBy('failure_type')
            ->pluck('count', 'failure_type')
            ->toArray();

        $byStatus = RepairSession::where('company_id', $companyId)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        return [
            'total_sessions'    => $totalSessions,
            'active_sessions'   => $activeSessions,
            'completed_today'   => $completedToday,
            'failed_today'      => $failedToday,
            'success_rate'      => $successRate,
            'recent_sessions'   => $recentSessions,
            'by_failure_type'   => $byFailureType,
            'by_status'         => $byStatus,
        ];
    }

    private function buildDescription(RepairSession $session, RepairAnalysis $analysis): string
    {
        return $this->analysisEngine->describeRootCause(
            $session->failure_type->value,
            $analysis->root_cause,
            $session->failure_context ?? [],
        );
    }
}
