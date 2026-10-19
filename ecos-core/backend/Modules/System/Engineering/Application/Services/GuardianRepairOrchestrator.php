<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\GuardianCheckCategory;
use Modules\System\Engineering\Domain\Enums\GuardianRunStatus;
use Modules\System\Engineering\Domain\Models\GuardianCheck;
use Modules\System\Engineering\Domain\Models\GuardianRun;

/**
 * Orchestrates repair via the existing AI Repair Platform (TASK-ENG-V2-003).
 *
 * NEVER invokes Claude autonomously, never applies patches, never commits —
 * it opens a repair session and prepares the prompt package; a human drives
 * the Claude Code loop (ADR-032 boundary).
 */
final class GuardianRepairOrchestrator
{
    public function __construct(
        private readonly RepairEngine $repairEngine,
    ) {}

    /**
     * Open a repair session for a blocked Guardian run and prepare the
     * Claude prompt package. The run transitions to AwaitingRepair; a
     * human takes it from there.
     *
     * @param  \Illuminate\Support\Collection|array<int, GuardianCheck>  $failedChecks
     * @return array{session: \Modules\System\Engineering\Domain\Models\RepairSession, package: array<string, mixed>}
     */
    public function orchestrate(GuardianRun $run, $failedChecks, ?string $actorId = null): array
    {
        $failedChecks = collect($failedChecks);

        $worst       = $this->worstCategory($failedChecks);
        $failureType = $worst->defaultFailureType();

        $summary = 'Guardian run '.$run->id.' blocked: '.$run->failed_checks_count
            .' failed checks on branch '.($run->branch ?? 'unknown');

        $firstFailed = $failedChecks->first();

        $context = [
            'summary'           => $summary,
            'error_message'     => substr((string) ($firstFailed->details ?? ''), 0, 1000),
            'files'             => $run->changed_files ?? [],
            'validation_errors' => $failedChecks
                ->take(5)
                ->flatMap(fn ($check) => is_array($check->evidence) ? $check->evidence : [])
                ->values()
                ->all(),
        ];

        $session = $this->repairEngine->initiate(
            $run->company_id,
            'guardian',
            $run->id,
            $failureType,
            substr($summary, 0, 1000),
            $context,
        );

        $session = $this->repairEngine->analyze($session);
        $package = $this->repairEngine->generatePrompt($session);

        $run->update([
            'repair_session_id' => $session->id,
            'status'            => GuardianRunStatus::AwaitingRepair,
        ]);

        return [
            'session' => $session->fresh(),
            'package' => $package,
        ];
    }

    /**
     * Highest-priority category present among the failed checks.
     * Priority: Security > Safety > AdrCompliance > Toolchain.
     *
     * @param  \Illuminate\Support\Collection|array<int, GuardianCheck>  $failedChecks
     */
    private function worstCategory($failedChecks): GuardianCheckCategory
    {
        $present = collect($failedChecks)
            ->map(function ($check) {
                $category = $check->category ?? null;

                if ($category instanceof GuardianCheckCategory) {
                    return $category;
                }

                return $category !== null
                    ? GuardianCheckCategory::tryFrom((string) $category)
                    : null;
            })
            ->filter()
            ->all();

        $priority = [
            GuardianCheckCategory::Security,
            GuardianCheckCategory::Safety,
            GuardianCheckCategory::AdrCompliance,
            GuardianCheckCategory::Toolchain,
        ];

        foreach ($priority as $candidate) {
            if (in_array($candidate, $present, true)) {
                return $candidate;
            }
        }

        return GuardianCheckCategory::Toolchain;
    }
}
