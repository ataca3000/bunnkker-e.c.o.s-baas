<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Events;

use Illuminate\Support\Carbon;

/**
 * An interview was booked.
 *
 * This is what a calendar subscribes to, and what an invitation is built from.
 * It carries the when, the where and the who — everything a calendar entry
 * needs — and HR neither creates that entry nor knows which module will.
 */
final class InterviewScheduled
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $interviewId,
        public readonly string $applicationId,
        public readonly string $applicantName,
        public readonly ?string $applicantEmail,
        public readonly string $jobTitle,
        public readonly Carbon $scheduledAt,
        public readonly int $durationMinutes,
        public readonly string $mode,
        public readonly ?string $location,
        public readonly ?string $interviewerEmployeeId,
    ) {}

    public function eventName(): string
    {
        return 'hr.recruitment.interview_scheduled';
    }

    public function eventId(): string
    {
        return 'hr.recruitment.interview_scheduled:'.$this->interviewId;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'company_id' => $this->companyId,
            'interview_id' => $this->interviewId,
            'application_id' => $this->applicationId,
            'applicant_name' => $this->applicantName,
            'applicant_email' => $this->applicantEmail,
            'job_title' => $this->jobTitle,
            'scheduled_at' => $this->scheduledAt->toDateTimeString(),
            'duration_minutes' => $this->durationMinutes,
            'mode' => $this->mode,
            'location' => $this->location,
            'interviewer_employee_id' => $this->interviewerEmployeeId,
        ];
    }
}
