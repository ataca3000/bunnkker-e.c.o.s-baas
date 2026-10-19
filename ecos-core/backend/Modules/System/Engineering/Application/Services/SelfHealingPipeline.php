<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use RuntimeException;
use Throwable;
use Modules\System\Engineering\Domain\Enums\PatchValidationStatus;
use Modules\System\Engineering\Domain\Enums\ValidationStepStatus;
use Modules\System\Engineering\Domain\Enums\ValidationVerdict;
use Modules\System\Engineering\Domain\Enums\ValidatorType;
use Modules\System\Engineering\Domain\Models\PatchValidation;
use Modules\System\Engineering\Domain\Models\RepairMetric;
use Modules\System\Engineering\Domain\Models\RepairPatch;
use Modules\System\Engineering\Domain\Models\ValidationHistory;
use Modules\System\Engineering\Domain\Models\ValidationStep;

/**
 * Self-Healing Pipeline orchestrator (TASK-ENG-V2-002).
 *
 * Runs every applicable validator against a repair patch and issues a
 * final verdict. Hard invariants:
 *
 *  (1) A patch with any failed blocking validator is REJECTED. There is
 *      no exception path: no override flag, no bypass, no partial pass.
 *  (2) A step is marked Skipped in exactly two situations, neither of
 *      which can produce acceptance: it is structurally inapplicable to
 *      the patch file set (decided BEFORE execution), or the run aborted
 *      fail-fast after an earlier blocking failure (the verdict is
 *      already Rejected at that point).
 *  (3) Every step result and lifecycle event is persisted: step rows,
 *      counts on the validation, an append-only ValidationHistory trail,
 *      and validation metrics.
 *  (4) A blocking failure on an APPLIED patch triggers automatic
 *      rollback from the pre-apply snapshots.
 */
final class SelfHealingPipeline
{
    private const OUTPUT_MAX_CHARS = 64000;

    public function __construct(
        private readonly PatchValidatorRegistry  $registry,
        private readonly CommandValidatorRunner  $runner,
        private readonly PatchSecurityValidator  $securityValidator,
        private readonly AdrComplianceValidator  $adrValidator,
        private readonly PatchSafetyRuleEngine   $safetyEngine,
        private readonly ValidationReportService $reportService,
        private readonly PatchRollbackService    $rollbackService,
        private readonly AIMetricsEngine         $supervisorMetrics,
    ) {}

    /**
     * Create a new validation run for a patch with one step per validator.
     *
     * Applicability is decided here, before execution (invariant #2).
     */
    public function startValidation(RepairPatch $patch, ?string $actorId = null): PatchValidation
    {
        $attempt = (int) PatchValidation::query()
            ->where('patch_id', $patch->id)
            ->max('attempt_number') + 1;

        $maxAttempts = (int) config('engineering.self_healing.max_attempts', 3);

        if ($attempt > $maxAttempts) {
            throw new RuntimeException(
                "Maximum validation attempts ({$maxAttempts}) exceeded for this patch"
            );
        }

        $files = $patch->files_affected ?? [];

        $validation = PatchValidation::create([
            'company_id'     => $patch->company_id,
            'patch_id'       => $patch->id,
            'session_id'     => $patch->session_id,
            'attempt_number' => $attempt,
            'status'         => PatchValidationStatus::Pending,
            'triggered_by'   => $actorId,
        ]);

        $totalSteps = 0;

        foreach (ValidatorType::ordered() as $type) {
            $isApplicable = $type->appliesTo($files);

            ValidationStep::create([
                'validation_id' => $validation->id,
                'company_id'    => $patch->company_id,
                'validator'     => $type,
                'sequence'      => $type->sequence(),
                'status'        => $isApplicable ? ValidationStepStatus::Pending : ValidationStepStatus::Skipped,
                'is_blocking'   => true,
                'is_applicable' => $isApplicable,
            ]);

            $totalSteps++;
        }

        $validation->update(['total_steps' => $totalSteps]);

        $this->recordHistory($validation, 'validation.created', ['attempt' => $attempt], $actorId);

        return $validation;
    }

    /**
     * Execute a validation run in sequence order and issue a verdict.
     *
     * Fail-fast (default, engineering.self_healing.fail_fast): the run
     * stops at the first blocking failure, records the failed stage,
     * marks the un-executed remainder as skipped-by-abort, triggers
     * rollback of applied patches, and returns the complete result.
     * With fail_fast=false, all applicable validators run so the final
     * report covers every stage. Either way, any blocking failure
     * rejects the patch (invariant #1).
     */
    public function execute(PatchValidation $validation): PatchValidation
    {
        $validation->update([
            'status'     => PatchValidationStatus::Running,
            'started_at' => now(),
        ]);

        $this->recordHistory($validation, 'validation.started');

        $patch    = $validation->patch;
        $files    = $patch->files_affected ?? [];
        $failFast = (bool) config('engineering.self_healing.fail_fast', true);

        $hasBlockingFailure = false;
        $passedSteps        = 0;
        $failedSteps        = 0;
        $skippedSteps       = 0;
        $failedValidators   = [];
        $firstFailedStage   = null;
        $aborted            = false;

        /** @var ValidationStep $step */
        foreach ($validation->steps()->orderBy('sequence')->get() as $step) {
            if ($step->status === ValidationStepStatus::Skipped) {
                $skippedSteps++;

                continue;
            }

            if ($aborted) {
                // Fail-fast abort: never executed, never bypassed — the
                // verdict is already Rejected before this stage is reached.
                $step->update([
                    'status'       => ValidationStepStatus::Skipped,
                    'output'       => "Not executed: run aborted fail-fast after failed stage '{$firstFailedStage}'.",
                    'completed_at' => now(),
                ]);

                $skippedSteps++;

                continue;
            }

            $step->update([
                'status'     => ValidationStepStatus::Running,
                'started_at' => now(),
            ]);

            $result = $this->runStep($step->validator, $patch, $files);

            $passed = (bool) $result['passed'];

            $step->update([
                'status'       => $passed ? ValidationStepStatus::Passed : ValidationStepStatus::Failed,
                'exit_code'    => $result['exit_code'],
                'output'       => $this->truncate((string) $result['output']),
                'error_output' => $this->truncate((string) $result['error_output']),
                'duration_ms'  => $result['duration_ms'],
                'completed_at' => now(),
            ]);

            if ($passed) {
                $passedSteps++;
            } else {
                $failedSteps++;
                $failedValidators[] = $step->validator->value;
                $firstFailedStage ??= $step->validator->value;

                if ($step->is_blocking) {
                    $hasBlockingFailure = true;
                }
            }

            $this->recordHistory($validation, 'step.completed', [
                'validator' => $step->validator->value,
                'status'    => $passed ? ValidationStepStatus::Passed->value : ValidationStepStatus::Failed->value,
            ]);

            if ($hasBlockingFailure && $failFast && ! $aborted) {
                $aborted = true;

                $this->recordHistory($validation, 'validation.aborted', [
                    'failed_stage' => $firstFailedStage,
                ]);
            }
        }

        $verdict = $hasBlockingFailure ? ValidationVerdict::Rejected : ValidationVerdict::Accepted;
        $status  = $hasBlockingFailure ? PatchValidationStatus::Failed : PatchValidationStatus::Passed;

        $validation->update([
            'status'              => $status,
            'verdict'             => $verdict,
            'passed_steps'        => $passedSteps,
            'failed_steps'        => $failedSteps,
            'skipped_steps'       => $skippedSteps,
            'is_blocking_failure' => $hasBlockingFailure,
            'completed_at'        => now(),
            'failure_summary'     => $failedValidators === [] ? null : implode(', ', $failedValidators),
        ]);

        $patch->update([
            'verification_status' => $hasBlockingFailure ? 'failed' : 'passed',
        ]);

        if ($hasBlockingFailure && $patch->fresh()->is_applied) {
            $this->rollbackAppliedPatch($validation, $patch);
        }

        $this->reportService->generate($validation->fresh('steps'));

        $this->recordHistory($validation, 'validation.completed', ['verdict' => $verdict->value]);

        $this->recordMetrics($validation->fresh(), $firstFailedStage);

        return $validation->fresh();
    }

    /**
     * Roll back an applied patch after a blocking validation failure.
     *
     * Rollback problems never mask the validation result — they are
     * recorded in the history trail and the run still returns Rejected.
     */
    private function rollbackAppliedPatch(PatchValidation $validation, RepairPatch $patch): void
    {
        try {
            $restored = $this->rollbackService->rollback(
                $patch,
                $validation->triggered_by ?? 'system',
            );

            $this->recordHistory($validation, 'rollback.executed', [
                'restored_files' => $restored,
            ]);
        } catch (Throwable $e) {
            $this->recordHistory($validation, 'rollback.unavailable', [
                'error' => mb_substr($e->getMessage(), 0, 500),
            ]);
        }
    }

    /**
     * Record validation metrics for trend analysis and for the AI
     * Engineering Supervisor (ENG-009) quality dimensions.
     */
    private function recordMetrics(PatchValidation $validation, ?string $firstFailedStage): void
    {
        try {
            $durationMs = $validation->started_at && $validation->completed_at
                ? (int) $validation->started_at->diffInMilliseconds($validation->completed_at)
                : 0;

            $dimensions = [
                'verdict' => $validation->verdict?->value,
                'attempt' => $validation->attempt_number,
            ];

            if ($firstFailedStage !== null) {
                $dimensions['failed_stage'] = $firstFailedStage;
            }

            RepairMetric::create([
                'company_id'   => $validation->company_id,
                'metric_type'  => 'validation',
                'metric_key'   => 'validation.completed',
                'metric_value' => $validation->verdict === ValidationVerdict::Accepted ? 1.0 : 0.0,
                'dimensions'   => $dimensions,
                'recorded_at'  => now(),
            ]);

            RepairMetric::create([
                'company_id'   => $validation->company_id,
                'metric_type'  => 'validation',
                'metric_key'   => 'validation.duration_ms',
                'metric_value' => (float) $durationMs,
                'dimensions'   => $dimensions,
                'recorded_at'  => now(),
            ]);

            $this->supervisorMetrics->record(
                $validation->company_id,
                'self_healing',
                'patch_validation',
                $validation->verdict === ValidationVerdict::Accepted ? 1.0 : 0.0,
                $dimensions,
            );
        } catch (Throwable $e) {
            // Metrics must never affect the validation outcome.
            $this->recordHistory($validation, 'metrics.failed', [
                'error' => mb_substr($e->getMessage(), 0, 500),
            ]);
        }
    }

    /**
     * Run a fresh validation attempt for a patch end-to-end.
     *
     * Attempt numbering and the max-attempts ceiling are enforced by
     * startValidation().
     */
    public function revalidate(RepairPatch $patch, ?string $actorId = null): PatchValidation
    {
        $validation = $this->startValidation($patch, $actorId);

        return $this->execute($validation);
    }

    /**
     * Cancel a non-terminal validation run.
     */
    public function cancel(PatchValidation $validation, ?string $actorId = null): void
    {
        if ($validation->isTerminal()) {
            throw new RuntimeException('Cannot cancel a validation that is already terminal.');
        }

        $validation->update([
            'status'       => PatchValidationStatus::Cancelled,
            'completed_at' => now(),
        ]);

        $this->recordHistory($validation, 'validation.cancelled', [], $actorId);
    }

    /**
     * Latest validation attempt for a patch, or null when none exist.
     */
    public function latestForPatch(string $patchId): ?PatchValidation
    {
        return PatchValidation::query()
            ->where('patch_id', $patchId)
            ->orderByDesc('attempt_number')
            ->orderByDesc('created_at')
            ->first();
    }

    /**
     * Dispatch a single validator and normalize its result.
     *
     * @param  array<int, string>  $files
     * @return array{passed: bool, exit_code: int|null, output: string, error_output: string, duration_ms: int}
     */
    private function runStep(ValidatorType $type, RepairPatch $patch, array $files): array
    {
        return match ($type) {
            ValidatorType::SafetyRules => $this->violationsToResult(
                $this->safetyEngine->evaluate($patch, $patch->company_id)
            ),
            ValidatorType::Security => $this->violationsToResult(
                $this->securityValidator->analyze($patch)
            ),
            ValidatorType::AdrCompliance => $this->violationsToResult(
                $this->adrValidator->analyze($patch)
            ),
            default => $this->toolchainResult($type, $files),
        };
    }

    /**
     * @param  array<int, string>  $files
     * @return array{passed: bool, exit_code: int|null, output: string, error_output: string, duration_ms: int}
     */
    private function toolchainResult(ValidatorType $type, array $files): array
    {
        $r = $this->runner->run($type, $files);

        $errorOutput = (string) ($r['error_output'] ?? '');

        if (isset($r['error']) && $r['error']) {
            $errorOutput .= "\n" . $r['error'];
        }

        return [
            'passed'       => (bool) $r['passed'],
            'exit_code'    => $r['exit_code'],
            'output'       => (string) ($r['output'] ?? ''),
            'error_output' => $errorOutput,
            'duration_ms'  => (int) ($r['duration_ms'] ?? 0),
        ];
    }

    /**
     * Convert a static-analyzer violation list into a normalized step result.
     *
     * @param  array<int, mixed>  $violations
     * @return array{passed: bool, exit_code: int, output: string, error_output: string, duration_ms: int}
     */
    private function violationsToResult(array $violations): array
    {
        $passed = $violations === [];

        return [
            'passed'       => $passed,
            'exit_code'    => $passed ? 0 : 1,
            'output'       => $passed
                ? 'No violations'
                : (string) json_encode($violations, JSON_PRETTY_PRINT),
            'error_output' => '',
            'duration_ms'  => 0,
        ];
    }

    private function truncate(string $text): string
    {
        if (mb_strlen($text) <= self::OUTPUT_MAX_CHARS) {
            return $text;
        }

        return mb_substr($text, 0, self::OUTPUT_MAX_CHARS);
    }

    /**
     * Append an immutable lifecycle event to the validation history trail.
     *
     * @param  array<string, mixed>  $data
     */
    private function recordHistory(
        PatchValidation $validation,
        string $eventType,
        array $data = [],
        ?string $actorId = null,
    ): void {
        ValidationHistory::create([
            'validation_id' => $validation->id,
            'patch_id'      => $validation->patch_id,
            'company_id'    => $validation->company_id,
            'event_type'    => $eventType,
            'event_data'    => $data === [] ? null : $data,
            'actor_id'      => $actorId,
            'occurred_at'   => now(),
        ]);
    }
}
