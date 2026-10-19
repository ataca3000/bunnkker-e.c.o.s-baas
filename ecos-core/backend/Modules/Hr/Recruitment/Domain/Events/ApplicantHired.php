<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Events;

use Illuminate\Support\Carbon;

/**
 * An applicant became an employee.
 *
 * The moment recruitment hands over to the workforce master. Announced so
 * onboarding, IT provisioning or a welcome message can follow without HR
 * knowing any of them exist.
 */
final class ApplicantHired
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $applicantId,
        public readonly string $applicationId,
        public readonly string $employeeId,
        public readonly string $employeeNumber,
        public readonly string $employeeName,
        public readonly ?string $departmentId,
        public readonly ?string $positionId,
        public readonly string $hireDate,
        public readonly Carbon $hiredAt,
    ) {}

    public function eventName(): string
    {
        return 'hr.recruitment.applicant_hired';
    }

    public function eventId(): string
    {
        return 'hr.recruitment.applicant_hired:'.$this->applicationId;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'company_id' => $this->companyId,
            'applicant_id' => $this->applicantId,
            'application_id' => $this->applicationId,
            'employee_id' => $this->employeeId,
            'employee_number' => $this->employeeNumber,
            'employee_name' => $this->employeeName,
            'department_id' => $this->departmentId,
            'position_id' => $this->positionId,
            'hire_date' => $this->hireDate,
            'hired_at' => $this->hiredAt->toDateTimeString(),
        ];
    }
}
