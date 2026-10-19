<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Modules\Hr\Recruitment\Domain\Enums\EvaluationRating;
use Modules\Hr\Recruitment\Domain\Enums\InterviewStatus;
use Modules\Hr\Recruitment\Domain\Events\InterviewScheduled;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\ApplicationEvaluation;
use Modules\Hr\Recruitment\Domain\Models\Interview;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** Interviews and the evaluations that come out of them. */
final class InterviewService
{
    /** Book an interview and announce it — a calendar subscribes, HR does not write one. */
    public function schedule(JobApplication $application, array $data, ?int $actorId = null): Interview
    {
        $scheduledAt = Carbon::parse($data['scheduled_at']);

        $interview = Interview::create([
            'company_id' => $application->company_id,
            'application_id' => $application->id,
            'stage_id' => $data['stage_id'] ?? $application->current_stage_id,
            'interviewer_employee_id' => $data['interviewer_employee_id'] ?? null,
            'title' => $data['title'] ?? null,
            'scheduled_at' => $scheduledAt,
            'duration_minutes' => (int) ($data['duration_minutes'] ?? 60),
            'mode' => $data['mode'] ?? 'onsite',
            'location' => $data['location'] ?? null,
            'panel' => $data['panel'] ?? null,
            'status' => InterviewStatus::Scheduled->value,
            'created_by' => $actorId,
        ]);

        $applicant = $application->applicant;
        $opening = $application->jobOpening;

        Event::dispatch(new InterviewScheduled(
            companyId: (string) $application->company_id,
            interviewId: (string) $interview->id,
            applicationId: (string) $application->id,
            applicantName: (string) ($applicant->full_name ?? ''),
            applicantEmail: $applicant->email ?? null,
            jobTitle: (string) ($opening->title ?? ''),
            scheduledAt: $scheduledAt,
            durationMinutes: (int) $interview->duration_minutes,
            mode: (string) $interview->mode,
            location: $interview->location,
            interviewerEmployeeId: $interview->interviewer_employee_id === null
                ? null
                : (string) $interview->interviewer_employee_id,
        ));

        return $interview;
    }

    public function reschedule(Interview $interview, string $scheduledAt): Interview
    {
        $interview->update(['scheduled_at' => Carbon::parse($scheduledAt), 'status' => InterviewStatus::Scheduled->value]);

        return $interview->refresh();
    }

    /** Record that it happened, with what was decided. */
    public function complete(Interview $interview, array $data): Interview
    {
        $interview->update([
            'status' => InterviewStatus::Completed->value,
            'decision' => $data['decision'] ?? 'undecided',
            'notes' => $data['notes'] ?? $interview->notes,
            'occurred_at' => Carbon::now(),
        ]);

        return $interview->refresh();
    }

    public function cancel(Interview $interview, ?string $note = null): Interview
    {
        $interview->update([
            'status' => InterviewStatus::Cancelled->value,
            'notes' => $note ?? $interview->notes,
        ]);

        return $interview->refresh();
    }

    public function markNoShow(Interview $interview): Interview
    {
        $interview->update(['status' => InterviewStatus::NoShow->value, 'occurred_at' => Carbon::now()]);

        return $interview->refresh();
    }

    /** Record an evaluation — a named rating, a score, or both. */
    public function evaluate(JobApplication $application, array $data, ?Employee $reviewer = null, ?int $actorId = null): ApplicationEvaluation
    {
        $rating = isset($data['rating'])
            ? (EvaluationRating::tryFrom((string) $data['rating']) ?? EvaluationRating::Average)
            : EvaluationRating::fromScore((int) ($data['score'] ?? 50));

        return ApplicationEvaluation::create([
            'company_id' => $application->company_id,
            'application_id' => $application->id,
            'stage_id' => $data['stage_id'] ?? $application->current_stage_id,
            'reviewer_employee_id' => $reviewer?->id,
            'rating' => $rating->value,
            'score' => isset($data['score']) ? (int) $data['score'] : $rating->defaultScore(),
            'comments' => $data['comments'] ?? null,
            'evaluated_at' => Carbon::now(),
            'created_by' => $actorId,
        ]);
    }

    /** Interviews still ahead, for the workspace and any reminder. */
    public function upcoming(string $companyId, int $days = 14)
    {
        return Interview::query()
            ->with(['application.applicant:id,full_name,mobile,email', 'application.jobOpening:id,title'])
            ->where('company_id', $companyId)
            ->upcoming()
            ->where('scheduled_at', '<=', Carbon::now()->addDays($days))
            ->get();
    }

    /** Guard used by the controller before recording a decision. */
    public function assertCompleted(Interview $interview): void
    {
        if (! $interview->status->canRecordDecision()) {
            throw RecruitmentException::interviewNotCompleted();
        }
    }
}
