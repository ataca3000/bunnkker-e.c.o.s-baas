<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Recruitment\Domain\Enums\ApplicationStatus;
use Modules\Hr\Recruitment\Domain\Enums\TimelineEventType;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\ApplicantTag;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Models\RecruitmentStage;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Doing one thing to eighty candidacies.
 *
 * ┌─ BULK IS THE SAME ACT, REPEATED — NOT A SHORTCUT PAST THE RULES ────────┐
 * │ Every action here delegates to the service that owns it, one candidacy at   │
 * │ a time. Rejecting eighty applications runs the same status machine and       │
 * │ writes the same eighty timeline entries as rejecting one, because the        │
 * │ alternative — an UPDATE across the selection — is how a pipeline ends up     │
 * │ with rows in states the state machine says are impossible, and with no       │
 * │ record of who did it.                                                       │
 * │                                                                            │
 * │ It costs more queries. That is the correct trade: bulk work is where an      │
 * │ audit trail matters MOST, because it is where a single click can be wrong    │
 * │ eighty times.                                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ PARTIAL SUCCESS IS REPORTED, NOT HIDDEN ───────────────────────────────┐
 * │ One candidacy in a selection of eighty may legitimately refuse — already     │
 * │ hired, already rejected, wrong stage. Rolling all eighty back would punish   │
 * │ the recruiter for the pipeline being untidy; silently skipping it would let  │
 * │ them believe it worked. So each is attempted independently and the result    │
 * │ names every failure and why.                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class BulkRecruitmentService
{
    /**
     * A ceiling, because a selection of ten thousand is a mistake or a script,
     * and either way it should be refused rather than executed for four minutes.
     */
    public const MAX_SELECTION = 200;

    public function __construct(
        private readonly JobApplicationService $applications,
        private readonly RecruitmentPipelineService $pipeline,
        private readonly InterviewService $interviews,
        private readonly ApplicantService $applicants,
        private readonly ApplicantTagService $tags,
        private readonly ApplicantTimelineService $timeline,
    ) {}

    /** The actions the UI may offer, and what each one needs. */
    public const ACTIONS = [
        'move_stage' => ['label' => 'Move Pipeline Stage', 'requires' => ['stage_id'], 'permission' => 'hr.recruitment.decide'],
        'assign_recruiter' => ['label' => 'Assign Recruiter', 'requires' => ['recruiter_employee_id'], 'permission' => 'hr.recruitment.manage'],
        'schedule_interview' => ['label' => 'Assign Interview', 'requires' => ['scheduled_at'], 'permission' => 'hr.interviews.manage'],
        'reject' => ['label' => 'Reject', 'requires' => ['reason'], 'permission' => 'hr.recruitment.decide'],
        'archive' => ['label' => 'Archive', 'requires' => [], 'permission' => 'hr.recruitment.manage'],
        'talent_pool' => ['label' => 'Move to Talent Pool', 'requires' => [], 'permission' => 'hr.recruitment.manage'],
        'add_tag' => ['label' => 'Add Tag', 'requires' => ['tag_id'], 'permission' => 'hr.recruitment.tag'],
        'export' => ['label' => 'Export', 'requires' => [], 'permission' => 'hr.recruitment.view'],
    ];

    /**
     * Run one action across a selection.
     *
     * @param  array<int, string>  $applicationIds
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function execute(
        string $companyId,
        string $action,
        array $applicationIds,
        array $payload = [],
        ?int $actorId = null,
    ): array {
        if (! array_key_exists($action, self::ACTIONS)) {
            throw RecruitmentException::unknownBulkAction($action);
        }

        $ids = array_values(array_unique($applicationIds));

        if (count($ids) > self::MAX_SELECTION) {
            throw RecruitmentException::bulkLimitExceeded(count($ids), self::MAX_SELECTION);
        }

        // Scoped by company in the query, not checked afterwards — an id from
        // another company simply is not found, and is reported as such.
        $applications = JobApplication::query()
            ->with(['applicant', 'jobOpening'])
            ->where('company_id', $companyId)
            ->whereIn('id', $ids)
            ->get();

        if ($action === 'export') {
            return $this->export($applications, $ids);
        }

        $succeeded = [];
        $failed = [];

        foreach ($ids as $id) {
            $application = $applications->firstWhere('id', $id);

            if ($application === null) {
                $failed[] = ['id' => $id, 'reason' => 'Not found in this company.'];

                continue;
            }

            try {
                // Each candidacy is its own transaction. One failure rolls back
                // only itself, so seventy-nine correct moves are not lost to it.
                DB::transaction(fn () => $this->apply($action, $application, $payload, $actorId));

                $succeeded[] = [
                    'id' => (string) $application->id,
                    'application_number' => $application->application_number,
                ];
            } catch (\Throwable $e) {
                $failed[] = [
                    'id' => (string) $application->id,
                    'application_number' => $application->application_number,
                    'reason' => $e->getMessage(),
                ];
            }
        }

        return [
            'action' => $action,
            'label' => self::ACTIONS[$action]['label'],
            'requested' => count($ids),
            'succeeded' => count($succeeded),
            'failed' => count($failed),
            'results' => $succeeded,
            'failures' => $failed,
        ];
    }

    /**
     * What the UI needs to build the confirmation dialog: what will happen, to how
     * many, and what it cannot be undone from.
     *
     * @param  array<int, string>  $applicationIds
     * @return array<string, mixed>
     */
    public function preview(string $companyId, string $action, array $applicationIds): array
    {
        if (! array_key_exists($action, self::ACTIONS)) {
            throw RecruitmentException::unknownBulkAction($action);
        }

        $applications = JobApplication::query()
            ->with('applicant:id,full_name')
            ->where('company_id', $companyId)
            ->whereIn('id', array_unique($applicationIds))
            ->get();

        $definition = self::ACTIONS[$action];

        return [
            'action' => $action,
            'label' => $definition['label'],
            'permission' => $definition['permission'],
            'requires' => $definition['requires'],
            'selected' => $applications->count(),
            'not_found' => count(array_unique($applicationIds)) - $applications->count(),
            // Named on the dialog. "Reject 80 applications" is abstract; a list of
            // people is what makes someone check before clicking.
            'candidates' => $applications->map(fn (JobApplication $a) => [
                'id' => (string) $a->id,
                'application_number' => $a->application_number,
                'name' => $a->applicant->full_name ?? null,
                'status' => $a->status->value,
            ])->all(),
            'is_reversible' => ! in_array($action, ['reject', 'talent_pool'], true),
        ];
    }

    // ── The actions ───────────────────────────────────────────────────────────

    /** @param array<string, mixed> $payload */
    private function apply(string $action, JobApplication $application, array $payload, ?int $actorId): void
    {
        match ($action) {
            'move_stage' => $this->moveStage($application, $payload, $actorId),
            'assign_recruiter' => $this->assignRecruiter($application, $payload, $actorId),
            'schedule_interview' => $this->scheduleInterview($application, $payload, $actorId),
            'reject' => $this->applications->decide(
                $application,
                ApplicationStatus::Rejected,
                (string) ($payload['reason'] ?? 'Bulk rejection'),
                $actorId,
            ),
            'archive' => $this->archive($application, $payload, $actorId),
            'talent_pool' => $this->toTalentPool($application, $payload, $actorId),
            'add_tag' => $this->addTag($application, $payload, $actorId),
            default => throw RecruitmentException::unknownBulkAction($action),
        };
    }

    /** @param array<string, mixed> $payload */
    private function moveStage(JobApplication $application, array $payload, ?int $actorId): void
    {
        $stage = RecruitmentStage::query()
            ->where('company_id', $application->company_id)
            ->findOrFail($payload['stage_id'] ?? null);

        $this->pipeline->assertBelongsTo((string) $application->company_id, $stage);

        $this->applications->moveToStage($application, $stage, $payload['note'] ?? null, $actorId);
    }

    /** @param array<string, mixed> $payload */
    private function assignRecruiter(JobApplication $application, array $payload, ?int $actorId): void
    {
        $recruiter = Employee::query()
            ->where('company_id', $application->company_id)
            ->findOrFail($payload['recruiter_employee_id'] ?? null);

        $previous = $application->recruiter_employee_id;

        $application->update(['recruiter_employee_id' => $recruiter->id]);

        $this->timeline->recordForApplication($application, TimelineEventType::RecruiterAssigned, [
            'title' => 'Recruiter assigned: '.$recruiter->fullName(),
            'subject_type' => 'employee',
            'subject_id' => (string) $recruiter->id,
            'context' => [
                'recruiter_employee_id' => (string) $recruiter->id,
                'recruiter_name' => $recruiter->fullName(),
                'previous_recruiter_employee_id' => $previous === null ? null : (string) $previous,
                'via' => 'bulk',
            ],
        ], $actorId);
    }

    /** @param array<string, mixed> $payload */
    private function scheduleInterview(JobApplication $application, array $payload, ?int $actorId): void
    {
        $this->interviews->schedule($application, [
            'scheduled_at' => $payload['scheduled_at'],
            'duration_minutes' => $payload['duration_minutes'] ?? 60,
            'mode' => $payload['mode'] ?? 'onsite',
            'location' => $payload['location'] ?? null,
            'title' => $payload['title'] ?? null,
            'interviewer_employee_id' => $payload['interviewer_employee_id'] ?? null,
            'stage_id' => $payload['stage_id'] ?? $application->current_stage_id,
        ], $actorId);
    }

    /** @param array<string, mixed> $payload */
    private function archive(JobApplication $application, array $payload, ?int $actorId): void
    {
        // Archiving parks a candidacy without judging it — the role was cancelled,
        // the season ended. The status is deliberately left alone so the funnel
        // does not record a rejection that never happened.
        $application->update(['archived_at' => Carbon::now()]);

        $this->timeline->recordForApplication($application, TimelineEventType::Archived, [
            'title' => 'Application archived',
            'summary' => $payload['reason'] ?? null,
            'context' => ['via' => 'bulk', 'reason' => $payload['reason'] ?? null],
        ], $actorId);
    }

    /** @param array<string, mixed> $payload */
    private function toTalentPool(JobApplication $application, array $payload, ?int $actorId): void
    {
        $this->applications->decide(
            $application,
            ApplicationStatus::TalentPool,
            (string) ($payload['reason'] ?? 'Moved to talent pool'),
            $actorId,
        );

        if ($application->applicant !== null) {
            $this->applicants->addToTalentPool($application->applicant, $payload['note'] ?? null);

            $this->timeline->recordForApplication($application, TimelineEventType::MovedToTalentPool, [
                'title' => 'Moved to talent pool',
                'summary' => $payload['note'] ?? null,
                'context' => ['via' => 'bulk'],
            ], $actorId);
        }
    }

    /** @param array<string, mixed> $payload */
    private function addTag(JobApplication $application, array $payload, ?int $actorId): void
    {
        $tag = ApplicantTag::query()
            ->where('company_id', $application->company_id)
            ->findOrFail($payload['tag_id'] ?? null);

        if ($application->applicant !== null) {
            $this->tags->assign($application->applicant, $tag, $payload['note'] ?? null, $actorId);
        }
    }

    /**
     * Export is a read. It changes nothing, writes no timeline entry, and returns
     * rows the caller renders as CSV.
     *
     * @param  \Illuminate\Database\Eloquent\Collection<int, JobApplication>  $applications
     * @param  array<int, string>  $requestedIds
     * @return array<string, mixed>
     */
    private function export($applications, array $requestedIds): array
    {
        $rows = $applications->map(fn (JobApplication $a) => [
            'application_number' => $a->application_number,
            'candidate_name' => $a->applicant->full_name ?? '',
            'mobile' => $a->applicant->mobile ?? '',
            'email' => $a->applicant->email ?? '',
            'job_opening' => $a->jobOpening->title ?? '',
            'status' => $a->status->label(),
            'source' => $a->source,
            'expected_salary' => $a->expected_salary === null ? '' : (float) $a->expected_salary,
            'years_experience' => $a->years_experience,
            'applied_at' => $a->applied_at?->toDateString(),
            'available_from' => $a->available_from?->toDateString(),
            'match_score' => $a->match_score,
        ])->all();

        return [
            'action' => 'export',
            'label' => self::ACTIONS['export']['label'],
            'requested' => count($requestedIds),
            'succeeded' => count($rows),
            'failed' => count($requestedIds) - count($rows),
            'columns' => array_keys($rows[0] ?? [
                'application_number' => null, 'candidate_name' => null, 'mobile' => null,
                'email' => null, 'job_opening' => null, 'status' => null, 'source' => null,
                'expected_salary' => null, 'years_experience' => null, 'applied_at' => null,
                'available_from' => null, 'match_score' => null,
            ]),
            'rows' => $rows,
        ];
    }
}
