<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Modules\Hr\Recruitment\Domain\Enums\ApplicationStatus;
use Modules\Hr\Recruitment\Domain\Events\ApplicationReceived;
use Modules\Hr\Recruitment\Domain\Events\ApplicationStageChanged;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\Applicant;
use Modules\Hr\Recruitment\Domain\Models\ApplicationStageEvent;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Models\JobOpening;
use Modules\Hr\Recruitment\Domain\Models\RecruitmentStage;

/**
 * Applications — submitted, moved through the pipeline, and decided.
 *
 * ┌─ SUBMITTING CREATES AN APPLICANT · NEVER AN EMPLOYEE ───────────────────┐
 * │ This service writes to `hr_applicants` and `hr_job_applications` and to no  │
 * │ other master. Someone who applies is a person the company is considering,   │
 * │ and creating an employee from a form submission would put strangers in the  │
 * │ workforce master. Becoming an employee is a separate, deliberate act with   │
 * │ its own permission — see HiringService.                                     │
 * │                                                                            │
 * │ Every move through the pipeline is LOGGED, so the history survives even     │
 * │ though the current stage is a single column.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class JobApplicationService
{
    public function __construct(
        private readonly RecruitmentPipelineService $pipeline,
        private readonly ApplicantScoringService $scoring,
    ) {}

    /**
     * Submit an application for an existing applicant.
     *
     * @param  array<string, mixed>  $data  the professional part of the form
     */
    public function submit(JobOpening $opening, Applicant $applicant, array $data, ?int $actorId = null): JobApplication
    {
        if (! $opening->isOpenForApplications()) {
            throw RecruitmentException::jobNotAcceptingApplications();
        }

        $alreadyApplied = JobApplication::query()
            ->where('job_opening_id', $opening->id)
            ->where('applicant_id', $applicant->id)
            ->exists();

        if ($alreadyApplied) {
            throw RecruitmentException::alreadyApplied();
        }

        $stage = $this->pipeline->initialStage((string) $opening->company_id);

        $application = DB::transaction(function () use ($opening, $applicant, $data, $stage, $actorId): JobApplication {
            $application = JobApplication::create([
                'company_id' => $opening->company_id,
                'job_opening_id' => $opening->id,
                'applicant_id' => $applicant->id,
                'current_stage_id' => $stage->id,
                'application_number' => $this->nextNumber((string) $opening->company_id),
                'years_experience' => $data['years_experience'] ?? null,
                'current_employer' => $data['current_employer'] ?? null,
                'previous_employer' => $data['previous_employer'] ?? null,
                'expected_salary' => $data['expected_salary'] ?? null,
                'currency' => $data['currency'] ?? 'EGP',
                'available_from' => $data['available_from'] ?? null,
                'additional_notes' => $data['additional_notes'] ?? null,
                'status' => ApplicationStatus::InPipeline->value,
                'source' => $data['source'] ?? 'careers_portal',
                'applied_at' => Carbon::now(),
            ]);

            $this->log($application, null, $stage, 'applied', null, ApplicationStatus::InPipeline->value, null, $actorId);

            // A deterministic first read on fit — a starting point, never a decision.
            $scored = $this->scoring->score($application->refresh(), $opening);
            $application->update([
                'match_score' => $scored['score'],
                'match_explanation' => $scored['explanation'],
            ]);

            return $application->refresh();
        });

        // Announced for whatever wants to acknowledge it — HR imports no notifier.
        Event::dispatch(new ApplicationReceived(
            companyId: (string) $application->company_id,
            applicationId: (string) $application->id,
            applicantId: (string) $applicant->id,
            jobOpeningId: (string) $opening->id,
            jobTitle: (string) $opening->title,
            applicantName: (string) $applicant->full_name,
            applicantEmail: $applicant->email,
            applicantMobile: (string) $applicant->mobile,
            appliedAt: $application->applied_at ?? Carbon::now(),
        ));

        return $application;
    }

    /** Move an application to a stage, logging the transition. */
    public function moveToStage(JobApplication $application, RecruitmentStage $stage, ?string $note = null, ?int $actorId = null): JobApplication
    {
        $this->pipeline->assertBelongsTo((string) $application->company_id, $stage);

        $from = $application->currentStage;
        $action = $from === null || $stage->sequence > $from->sequence ? 'advanced' : 'moved_back';

        $updated = DB::transaction(function () use ($application, $stage, $from, $action, $note, $actorId): JobApplication {
            $application->update(['current_stage_id' => $stage->id]);
            $this->log($application, $from, $stage, $action, null, null, $note, $actorId);

            return $application->refresh();
        });

        Event::dispatch(new ApplicationStageChanged(
            companyId: (string) $updated->company_id,
            applicationId: (string) $updated->id,
            fromStage: $from?->name,
            toStage: (string) $stage->name,
            action: $action,
            occurredAt: Carbon::now(),
        ));

        return $updated;
    }

    /** Advance one step along the configured pipeline. */
    public function advance(JobApplication $application, ?string $note = null, ?int $actorId = null): JobApplication
    {
        $current = $application->currentStage;

        if ($current === null) {
            return $this->moveToStage($application, $this->pipeline->initialStage((string) $application->company_id), $note, $actorId);
        }

        $next = $this->pipeline->nextStage($current);

        return $next === null ? $application : $this->moveToStage($application, $next, $note, $actorId);
    }

    /** Record a decision — accept, reject, hold, send an offer, and so on. */
    public function decide(JobApplication $application, ApplicationStatus $target, ?string $reason = null, ?int $actorId = null): JobApplication
    {
        $from = $application->status;

        if (! $from->canTransitionTo($target)) {
            throw RecruitmentException::invalidApplicationTransition($from->value, $target->value);
        }

        return DB::transaction(function () use ($application, $from, $target, $reason, $actorId): JobApplication {
            $application->update([
                'status' => $target->value,
                'decided_at' => Carbon::now(),
                'decided_by' => $actorId,
                'decision_reason' => $reason ?? $application->decision_reason,
            ]);

            $this->log(
                $application, $application->currentStage, $application->currentStage,
                'decided', $from->value, $target->value, $reason, $actorId
            );

            return $application->refresh();
        });
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, ApplicationStageEvent> */
    public function history(JobApplication $application)
    {
        return $application->stageEvents()->with(['fromStage:id,name', 'toStage:id,name'])->get();
    }

    /**
     * The pipeline board for one opening — how many candidates sit at each stage.
     *
     * @return array<int, array<string, mixed>>
     */
    public function pipelineBoard(string $companyId, ?string $jobOpeningId = null): array
    {
        $counts = DB::table('hr_job_applications')
            ->where('company_id', $companyId)
            ->when($jobOpeningId !== null, fn ($q) => $q->where('job_opening_id', $jobOpeningId))
            ->whereIn('status', [ApplicationStatus::InPipeline->value, ApplicationStatus::Hold->value, ApplicationStatus::OfferSent->value, ApplicationStatus::Accepted->value])
            ->groupBy('current_stage_id')
            ->selectRaw('current_stage_id, count(*) as total')
            ->pluck('total', 'current_stage_id');

        return $this->pipeline->stages($companyId)->map(fn (RecruitmentStage $stage) => [
            'stage_id' => (string) $stage->id,
            'code' => $stage->code,
            'name' => $stage->name,
            'type' => $stage->type,
            'sequence' => $stage->sequence,
            'is_terminal' => $stage->is_terminal,
            'applications' => (int) ($counts[(string) $stage->id] ?? 0),
        ])->all();
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function log(
        JobApplication $application,
        ?RecruitmentStage $from,
        ?RecruitmentStage $to,
        string $action,
        ?string $fromStatus,
        ?string $toStatus,
        ?string $note,
        ?int $actorId,
    ): void {
        ApplicationStageEvent::create([
            'company_id' => $application->company_id,
            'application_id' => $application->id,
            'from_stage_id' => $from?->id,
            'to_stage_id' => $to?->id,
            'action' => $action,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'note' => $note,
            'actor_id' => $actorId,
            'occurred_at' => Carbon::now(),
        ]);
    }

    private function nextNumber(string $companyId): string
    {
        $last = JobApplication::query()
            ->where('company_id', $companyId)
            ->where('application_number', 'like', 'APL-%')
            ->orderByDesc('application_number')
            ->value('application_number');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'APL-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }
}
