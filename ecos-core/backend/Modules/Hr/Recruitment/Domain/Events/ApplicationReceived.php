<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Events;

use Illuminate\Support\Carbon;

/**
 * Somebody applied.
 *
 * ┌─ ANNOUNCED, NOT DELIVERED ──────────────────────────────────────────────┐
 * │ HR does not send the acknowledgement email — it says an application        │
 * │ arrived and carries everything a notifier would need to act. Whatever      │
 * │ module owns messaging subscribes when it is ready; HR imports no notifier  │
 * │ and breaks if none exists.                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ApplicationReceived
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $applicationId,
        public readonly string $applicantId,
        public readonly string $jobOpeningId,
        public readonly string $jobTitle,
        public readonly string $applicantName,
        public readonly ?string $applicantEmail,
        public readonly string $applicantMobile,
        public readonly Carbon $appliedAt,
    ) {}

    public function eventName(): string
    {
        return 'hr.recruitment.application_received';
    }

    public function eventId(): string
    {
        return 'hr.recruitment.application_received:'.$this->applicationId;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'company_id' => $this->companyId,
            'application_id' => $this->applicationId,
            'applicant_id' => $this->applicantId,
            'job_opening_id' => $this->jobOpeningId,
            'job_title' => $this->jobTitle,
            'applicant_name' => $this->applicantName,
            'applicant_email' => $this->applicantEmail,
            'applicant_mobile' => $this->applicantMobile,
            'applied_at' => $this->appliedAt->toDateTimeString(),
        ];
    }
}
