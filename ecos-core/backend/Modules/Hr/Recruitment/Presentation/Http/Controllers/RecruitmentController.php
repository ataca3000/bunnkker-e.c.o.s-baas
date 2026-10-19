<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Recruitment\Domain\Enums\ApplicationStatus;
use Modules\Hr\Recruitment\Domain\Models\Applicant;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Models\JobOpening;
use Modules\Hr\Recruitment\Domain\Models\RecruitmentStage;
use Modules\Hr\Recruitment\Domain\Services\ApplicantService;
use Modules\Hr\Recruitment\Domain\Services\JobApplicationService;
use Modules\Hr\Recruitment\Domain\Services\JobOpeningService;
use Modules\Hr\Recruitment\Domain\Services\RecruitmentPipelineService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Job openings, the pipeline, applicants and applications — the ATS workspace. */
class RecruitmentController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly JobOpeningService $openings,
        private readonly RecruitmentPipelineService $pipeline,
        private readonly ApplicantService $applicants,
        private readonly JobApplicationService $applications,
    ) {}

    // ── Job openings ──────────────────────────────────────────────────────────

    public function jobs(Request $request): JsonResponse
    {
        $rows = JobOpening::query()
            ->with(['department:id,name', 'employmentType:id,name'])
            ->withCount('applications')
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('department_id'), fn ($q) => $q->where('department_id', $request->string('department_id')))
            ->orderByDesc('created_at')->limit(200)->get()
            ->map(fn (JobOpening $j) => $this->jobPayload($j));

        return response()->json(['data' => $rows]);
    }

    public function storeJob(Request $request): JsonResponse
    {
        $v = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'department_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'position_id' => ['nullable', 'string'],
            'employment_type_id' => ['nullable', 'string'],
            'job_grade_id' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'responsibilities' => ['nullable', 'string'],
            'work_location' => ['nullable', 'string', 'max:200'],
            'work_mode' => ['nullable', 'in:onsite,hybrid,remote'],
            'salary_min' => ['nullable', 'numeric', 'min:0'],
            'salary_max' => ['nullable', 'numeric', 'min:0'],
            'show_salary' => ['nullable', 'boolean'],
            'openings_count' => ['nullable', 'integer', 'min:1', 'max:999'],
            'closes_on' => ['nullable', 'date'],
            'hiring_manager_employee_id' => ['nullable', 'string'],
        ]);

        $job = $this->openings->create($this->companyId($request), $v, $this->actorId($request));

        return response()->json(['data' => $this->jobPayload($job)], 201);
    }

    public function updateJob(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'description' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'responsibilities' => ['nullable', 'string'],
            'work_location' => ['nullable', 'string', 'max:200'],
            'work_mode' => ['nullable', 'in:onsite,hybrid,remote'],
            'salary_min' => ['nullable', 'numeric', 'min:0'],
            'salary_max' => ['nullable', 'numeric', 'min:0'],
            'show_salary' => ['nullable', 'boolean'],
            'openings_count' => ['nullable', 'integer', 'min:1', 'max:999'],
            'closes_on' => ['nullable', 'date'],
            'department_id' => ['nullable', 'string'],
            'position_id' => ['nullable', 'string'],
            'hiring_manager_employee_id' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->jobPayload($this->openings->update($this->job($request, $id), $v))]);
    }

    /** Publish, hold or close — opening a job needs no deployment. */
    public function transitionJob(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['action' => ['required', 'in:publish,hold,close']]);
        $job = $this->job($request, $id);

        $job = match ($v['action']) {
            'publish' => $this->openings->publish($job),
            'hold' => $this->openings->hold($job),
            default => $this->openings->close($job),
        };

        return response()->json(['data' => $this->jobPayload($job)]);
    }

    // ── Pipeline ──────────────────────────────────────────────────────────────

    public function stages(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->pipeline->stages($this->companyId($request))]);
    }

    public function storeStage(Request $request): JsonResponse
    {
        $v = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:120'],
            'sequence' => ['nullable', 'integer', 'min:1', 'max:99'],
            'type' => ['nullable', 'in:applied,screening,interview,offer,decision'],
            'is_initial' => ['nullable', 'boolean'],
            'is_terminal' => ['nullable', 'boolean'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        return response()->json(['data' => $this->pipeline->create($this->companyId($request), $v)], 201);
    }

    public function updateStage(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'sequence' => ['nullable', 'integer', 'min:1', 'max:99'],
            'type' => ['nullable', 'in:applied,screening,interview,offer,decision'],
            'is_initial' => ['nullable', 'boolean'],
            'is_terminal' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        $stage = RecruitmentStage::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();

        return response()->json(['data' => $this->pipeline->update($stage, $v)]);
    }

    /** The board: how many candidates sit at each stage. */
    public function board(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->applications->pipelineBoard(
                $this->companyId($request),
                $request->filled('job_opening_id') ? $request->string('job_opening_id')->toString() : null,
            ),
        ]);
    }

    // ── Applications ──────────────────────────────────────────────────────────

    /** The ATS list — filterable and searchable, as an ATS must be. */
    public function applications(Request $request): JsonResponse
    {
        $perPage = min(100, max(5, (int) $request->integer('per_page', 25)));

        $query = JobApplication::query()
            ->with(['applicant:id,full_name,mobile,email,in_talent_pool', 'jobOpening:id,title,department_id', 'currentStage:id,name,sequence'])
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('job_opening_id'), fn ($q) => $q->where('job_opening_id', $request->string('job_opening_id')))
            ->when($request->filled('stage_id'), fn ($q) => $q->where('current_stage_id', $request->string('stage_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('source'), fn ($q) => $q->where('source', $request->string('source')))
            ->when($request->filled('min_experience'), fn ($q) => $q->where('years_experience', '>=', $request->float('min_experience')))
            ->when($request->filled('applied_from'), fn ($q) => $q->where('applied_at', '>=', $request->string('applied_from').' 00:00:00'))
            ->when($request->filled('applied_to'), fn ($q) => $q->where('applied_at', '<=', $request->string('applied_to').' 23:59:59'))
            ->when($request->filled('department_id'), function ($q) use ($request): void {
                $q->whereHas('jobOpening', fn ($j) => $j->where('department_id', $request->string('department_id')));
            })
            ->when($request->filled('branch_id'), function ($q) use ($request): void {
                $q->whereHas('jobOpening', fn ($j) => $j->where('branch_id', $request->string('branch_id')));
            })
            // Search by name, phone or email — the three things a recruiter has.
            ->when($request->filled('search'), function ($q) use ($request): void {
                $term = '%'.$request->string('search')->toString().'%';
                $q->whereHas('applicant', function ($a) use ($term): void {
                    $a->where('full_name', 'like', $term)
                        ->orWhere('mobile', 'like', $term)
                        ->orWhere('email', 'like', $term);
                });
            })
            ->orderByDesc('applied_at');

        $page = $query->paginate($perPage);

        return response()->json([
            'data' => [
                'items' => collect($page->items())->map(fn (JobApplication $a) => $this->applicationPayload($a))->all(),
                'meta' => [
                    'current_page' => $page->currentPage(),
                    'per_page' => $page->perPage(),
                    'total' => $page->total(),
                    'last_page' => $page->lastPage(),
                ],
            ],
        ]);
    }

    /** One application, with everything recorded against it. */
    public function application(Request $request, string $id): JsonResponse
    {
        $application = $this->findApplication($request, $id);
        $application->load([
            'applicant.attachments', 'jobOpening:id,title,slug,department_id,salary_min,salary_max,currency',
            'currentStage:id,name,sequence', 'evaluations.reviewer:id,first_name,last_name',
            'interviews.interviewer:id,first_name,last_name',
        ]);

        return response()->json([
            'data' => $this->applicationPayload($application) + [
                'applicant' => $this->applicantPayload($application->applicant),
                'match_explanation' => $application->match_explanation,
                'average_score' => $application->averageScore(),
                'evaluations' => $application->evaluations->map(fn ($e) => [
                    'id' => (string) $e->id,
                    'rating' => $e->rating->value,
                    'rating_label' => $e->rating->label(),
                    'score' => $e->effectiveScore(),
                    'comments' => $e->comments,
                    'reviewer' => $e->reviewer === null ? null : $e->reviewer->fullName(),
                    'evaluated_at' => $e->evaluated_at?->toDateTimeString(),
                ])->all(),
                'interviews' => $application->interviews->map(fn ($i) => [
                    'id' => (string) $i->id,
                    'title' => $i->title,
                    'scheduled_at' => $i->scheduled_at?->toDateTimeString(),
                    'duration_minutes' => $i->duration_minutes,
                    'mode' => $i->mode,
                    'location' => $i->location,
                    'status' => $i->status->value,
                    'decision' => $i->decision,
                    'notes' => $i->notes,
                    'interviewer' => $i->interviewer === null ? null : $i->interviewer->fullName(),
                ])->all(),
                'history' => $this->applications->history($application)->map(fn ($e) => [
                    'action' => $e->action,
                    'from_stage' => $e->fromStage?->name,
                    'to_stage' => $e->toStage?->name,
                    'from_status' => $e->from_status,
                    'to_status' => $e->to_status,
                    'note' => $e->note,
                    'occurred_at' => $e->occurred_at?->toDateTimeString(),
                ])->all(),
            ],
        ]);
    }

    /** Move a candidate along the pipeline. */
    public function moveStage(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'stage_id' => ['nullable', 'string'],
            'note' => ['nullable', 'string', 'max:400'],
        ]);

        $application = $this->findApplication($request, $id);

        $moved = isset($v['stage_id'])
            ? $this->applications->moveToStage(
                $application,
                RecruitmentStage::query()->where('company_id', $this->companyId($request))
                    ->where('id', $v['stage_id'])->firstOrFail(),
                $v['note'] ?? null,
                $this->actorId($request),
            )
            : $this->applications->advance($application, $v['note'] ?? null, $this->actorId($request));

        return response()->json(['data' => $this->applicationPayload($moved)]);
    }

    /** Record a decision — accept, reject, hold, offer, talent pool. */
    public function decide(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'status' => ['required', 'string'],
            'reason' => ['nullable', 'string', 'max:400'],
        ]);

        $target = ApplicationStatus::tryFrom($v['status']);

        if ($target === null) {
            return response()->json(['message' => 'Unknown application status.'], 422);
        }

        $application = $this->applications->decide(
            $this->findApplication($request, $id), $target, $v['reason'] ?? null, $this->actorId($request)
        );

        // A talent-pool decision moves the PERSON, not just the candidacy.
        if ($target === ApplicationStatus::TalentPool && $application->applicant !== null) {
            $this->applicants->addToTalentPool($application->applicant, $v['reason'] ?? null);
        }

        return response()->json(['data' => $this->applicationPayload($application->refresh())]);
    }

    // ── Applicants & talent pool ──────────────────────────────────────────────

    public function applicants(Request $request): JsonResponse
    {
        $rows = Applicant::query()
            ->withCount('applications')
            ->where('company_id', $this->companyId($request))
            ->canonical()
            ->when($request->boolean('talent_pool'), fn ($q) => $q->where('in_talent_pool', true))
            ->when($request->filled('search'), function ($q) use ($request): void {
                $term = '%'.$request->string('search')->toString().'%';
                $q->where(fn ($inner) => $inner->where('full_name', 'like', $term)
                    ->orWhere('mobile', 'like', $term)
                    ->orWhere('email', 'like', $term));
            })
            ->orderByDesc('created_at')->limit(200)->get()
            ->map(fn (Applicant $a) => $this->applicantPayload($a));

        return response()->json(['data' => $rows]);
    }

    /** Who looks like this person already — before anyone creates a second record. */
    public function duplicates(Request $request): JsonResponse
    {
        $v = $request->validate([
            'mobile' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
        ]);

        return response()->json([
            'data' => $this->applicants->findDuplicates(
                $this->companyId($request), $v['mobile'] ?? null, $v['email'] ?? null
            ),
        ]);
    }

    public function merge(Request $request): JsonResponse
    {
        $v = $request->validate([
            'duplicate_id' => ['required', 'string'],
            'survivor_id' => ['required', 'string', 'different:duplicate_id'],
        ]);

        $survivor = $this->applicants->merge(
            $this->applicant($request, $v['duplicate_id']),
            $this->applicant($request, $v['survivor_id']),
            $this->actorId($request),
        );

        return response()->json(['data' => $this->applicantPayload($survivor)]);
    }

    public function talentPool(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'action' => ['required', 'in:add,remove'],
            'note' => ['nullable', 'string', 'max:400'],
            'tags' => ['nullable', 'array', 'max:10'],
            'tags.*' => ['string', 'max:40'],
        ]);

        $applicant = $this->applicant($request, $id);

        $applicant = $v['action'] === 'add'
            ? $this->applicants->addToTalentPool($applicant, $v['note'] ?? null, $v['tags'] ?? [])
            : $this->applicants->removeFromTalentPool($applicant);

        return response()->json(['data' => $this->applicantPayload($applicant)]);
    }

    // ── Payloads & lookups ────────────────────────────────────────────────────

    private function job(Request $request, string $id): JobOpening
    {
        return JobOpening::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    private function findApplication(Request $request, string $id): JobApplication
    {
        return JobApplication::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    private function applicant(Request $request, string $id): Applicant
    {
        return Applicant::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function jobPayload(JobOpening $job): array
    {
        return [
            'id' => (string) $job->id,
            'reference' => $job->reference,
            'slug' => $job->slug,
            'title' => $job->title,
            'department' => $job->department?->only(['id', 'name']),
            'employment_type' => $job->employmentType?->only(['id', 'name']),
            'work_location' => $job->work_location,
            'work_mode' => $job->work_mode,
            'status' => $job->status->value,
            'status_label' => $job->status->label(),
            'is_publicly_visible' => $job->status->isPubliclyVisible() && $job->is_public,
            'openings_count' => (int) $job->openings_count,
            'filled_count' => (int) $job->filled_count,
            'remaining_positions' => $job->remainingPositions(),
            'salary_min' => $job->salary_min === null ? null : (float) $job->salary_min,
            'salary_max' => $job->salary_max === null ? null : (float) $job->salary_max,
            'show_salary' => $job->show_salary,
            'currency' => $job->currency,
            'applications_count' => (int) ($job->applications_count ?? 0),
            'published_at' => $job->published_at?->toDateTimeString(),
            'closes_on' => $job->closes_on?->toDateString(),
        ];
    }

    /** @return array<string, mixed> */
    private function applicationPayload(JobApplication $application): array
    {
        return [
            'id' => (string) $application->id,
            'application_number' => $application->application_number,
            'applicant_id' => (string) $application->applicant_id,
            'applicant_name' => $application->applicant?->full_name,
            'applicant_mobile' => $application->applicant?->mobile,
            'applicant_email' => $application->applicant?->email,
            'job_opening_id' => (string) $application->job_opening_id,
            'job_title' => $application->jobOpening?->title,
            'stage' => $application->currentStage?->only(['id', 'name', 'sequence']),
            'status' => $application->status->value,
            'status_label' => $application->status->label(),
            'can_be_hired' => $application->canBeHired(),
            'years_experience' => $application->years_experience === null ? null : (float) $application->years_experience,
            'current_employer' => $application->current_employer,
            'expected_salary' => $application->expected_salary === null ? null : (float) $application->expected_salary,
            'available_from' => $application->available_from?->toDateString(),
            'source' => $application->source,
            'match_score' => $application->match_score,
            'applied_at' => $application->applied_at?->toDateTimeString(),
            'decided_at' => $application->decided_at?->toDateTimeString(),
            'decision_reason' => $application->decision_reason,
        ];
    }

    /** @return array<string, mixed>|null */
    private function applicantPayload(?Applicant $applicant): ?array
    {
        if ($applicant === null) {
            return null;
        }

        return [
            'id' => (string) $applicant->id,
            'applicant_number' => $applicant->applicant_number,
            'full_name' => $applicant->full_name,
            'mobile' => $applicant->mobile,
            'email' => $applicant->email,
            'birth_date' => $applicant->birth_date?->toDateString(),
            'city' => $applicant->city,
            'source' => $applicant->source,
            'status' => $applicant->status,
            'in_talent_pool' => $applicant->in_talent_pool,
            'talent_pool_note' => $applicant->talent_pool_note,
            'talent_pool_tags' => $applicant->talent_pool_tags,
            'is_hired' => $applicant->isHired(),
            'hired_employee_id' => $applicant->hired_employee_id === null ? null : (string) $applicant->hired_employee_id,
            'applications_count' => (int) ($applicant->applications_count ?? 0),
            'attachments' => $applicant->relationLoaded('attachments')
                ? $applicant->attachments->map(fn ($a) => [
                    'id' => (string) $a->id,
                    'type' => $a->type,
                    'title' => $a->title,
                    'file_name' => $a->file_name,
                    'mime_type' => $a->mime_type,
                    'file_size' => $a->file_size,
                ])->all()
                : null,
        ];
    }
}
