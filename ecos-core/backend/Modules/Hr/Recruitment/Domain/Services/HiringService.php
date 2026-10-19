<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Modules\Hr\Compensation\Domain\Services\SalaryStructureService;
use Modules\Hr\Recruitment\Domain\Enums\LifecycleEventType;
use Modules\Hr\Recruitment\Domain\Events\ApplicantHired;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Workforce\Domain\Enums\ContractType;
use Modules\Hr\Workforce\Domain\Enums\EmployeeDocumentType;
use Modules\Hr\Workforce\Domain\Enums\EmployeeStatus;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\EmployeeDocumentService;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;
use Modules\Hr\Workforce\Domain\Services\EmploymentContractService;
use Modules\Hr\Workforce\Domain\Services\ReportingLineService;

/**
 * Hiring — the one place an applicant becomes an employee.
 *
 * ┌─ ONE ACT · SIX RECORDS · NOTHING RE-TYPED ──────────────────────────────┐
 * │ Everything the recruiter already captured — the person, the job, the        │
 * │ department, the position, the agreed salary, the manager — is carried       │
 * │ across in a single transaction:                                            │
 * │                                                                            │
 * │   the employee (H1)          the employment contract (H1)                  │
 * │   the department/position    the reporting line (H1)                       │
 * │   the salary structure (H3)  the lifecycle entry (H5)                      │
 * │                                                                            │
 * │ Each is created by the service that OWNS it, so every rule those services   │
 * │ enforce — employee numbering, one active contract, no reporting cycle,      │
 * │ dated salary — still applies. Hiring orchestrates; it does not reimplement. │
 * │                                                                            │
 * │ The applicant's CV follows them into their employee file, because the       │
 * │ document was always about the person, not the application.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class HiringService
{
    public function __construct(
        private readonly EmployeeService $employees,
        private readonly EmploymentContractService $contracts,
        private readonly ReportingLineService $reportingLines,
        private readonly SalaryStructureService $salaries,
        private readonly EmployeeDocumentService $documents,
        private readonly JobOpeningService $openings,
        private readonly EmployeeLifecycleService $lifecycle,
        private readonly OfferService $offers,
        private readonly ApplicantTimelineService $timeline,
    ) {}

    /**
     * Hire an applicant whose offer has been accepted.
     *
     * ┌─ THE OFFER IS THE GATE ─────────────────────────────────────────────┐
     * │ Two checks, not one, and they answer different questions. The status   │
     * │ says the candidacy reached agreement; the offer record says what was    │
     * │ actually agreed — which salary, from which date, in which version. A    │
     * │ status can be set by hand, so hiring insists on the document too.       │
     * └──────────────────────────────────────────────────────────────────────┘
     *
     * @param  array<string, mixed>  $terms  hire date, salary, contract type, manager
     */
    public function hire(JobApplication $application, array $terms, ?int $actorId = null): Employee
    {
        if (! $application->canBeHired()) {
            throw RecruitmentException::notReadyToHire($application->status->value);
        }

        if ($this->offers->acceptedOfferFor($application) === null) {
            throw RecruitmentException::offerRequiredBeforeHiring();
        }

        $applicant = $application->applicant;

        if ($applicant === null) {
            throw RecruitmentException::notReadyToHire('unknown');
        }

        if ($applicant->isHired()) {
            throw RecruitmentException::alreadyHired();
        }

        $opening = $application->jobOpening;
        $hireDate = (string) ($terms['hire_date'] ?? Carbon::now()->toDateString());

        $employee = DB::transaction(function () use ($application, $applicant, $opening, $terms, $hireDate, $actorId): Employee {
            // 1. The employee — created by the module that owns workforce identity,
            //    so numbering, status and headcount rules all still apply.
            [$firstName, $lastName] = $this->splitName((string) $applicant->full_name);

            $employee = $this->employees->create((string) $application->company_id, [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'mobile' => $applicant->mobile,
                'personal_email' => $applicant->email,
                'work_email' => $terms['work_email'] ?? null,
                'date_of_birth' => $applicant->birth_date?->toDateString(),
                'city' => $applicant->city,
                'country' => $applicant->country,
                'department_id' => $terms['department_id'] ?? $opening?->department_id,
                'position_id' => $terms['position_id'] ?? $opening?->position_id,
                'job_grade_id' => $terms['job_grade_id'] ?? $opening?->job_grade_id,
                'employment_type_id' => $terms['employment_type_id'] ?? $opening?->employment_type_id,
                'branch_id' => $terms['branch_id'] ?? $opening?->branch_id,
                'hire_date' => $hireDate,
                // A new joiner starts on probation unless told otherwise.
                'status' => ($terms['status'] ?? EmployeeStatus::Probation->value),
                'notes' => 'Hired from application '.$application->application_number,
            ], $actorId);

            // 2. The employment contract.
            $contractType = ContractType::tryFrom((string) ($terms['contract_type'] ?? ''))
                ?? ContractType::Permanent;

            $contract = $this->contracts->issue((string) $application->company_id, $employee, [
                'type' => $contractType->value,
                'start_date' => $hireDate,
                'end_date' => $terms['contract_end_date'] ?? null,
                'probation_end_date' => $terms['probation_end_date'] ?? null,
                'weekly_hours' => $terms['weekly_hours'] ?? null,
                'notes' => 'Issued on hire from '.$application->application_number,
            ], $actorId);

            $this->contracts->activate($contract);

            // 3. The basic salary — Payroll's to own, so its service writes it.
            if (! empty($terms['basic_salary'])) {
                $this->salaries->assign($employee, (float) $terms['basic_salary'], [
                    'effective_from' => $hireDate,
                    'currency' => $terms['currency'] ?? 'EGP',
                    'notes' => 'Agreed on hire',
                ], $actorId);
            }

            // 4. The reporting line, if a manager was named.
            $managerId = $terms['reporting_manager_employee_id'] ?? $opening?->hiring_manager_employee_id;
            if ($managerId !== null) {
                $manager = Employee::query()
                    ->where('company_id', $application->company_id)
                    ->where('id', $managerId)
                    ->first();

                if ($manager !== null) {
                    $this->reportingLines->assignManager($employee, $manager, effectiveFrom: $hireDate);
                }
            }

            // 5. The CV follows the person into their employee file.
            $this->carryDocumentsOver($application, $employee, $actorId);

            // 6. The first entry in their employment history.
            $this->lifecycle->record($employee, LifecycleEventType::Hired, [
                'effective_date' => $hireDate,
                'reason' => 'Hired from '.($opening->title ?? 'recruitment'),
                'to_values' => [
                    'department_id' => $employee->department_id,
                    'position_id' => $employee->position_id,
                    'status' => $employee->status->value,
                ],
                'source_module' => 'recruitment',
                'source_reference' => (string) $application->id,
            ], $actorId);

            // Close the loop on both sides.
            $applicant->update([
                'hired_employee_id' => $employee->id,
                'hired_at' => Carbon::now(),
                'status' => 'hired',
                'in_talent_pool' => false,
            ]);

            $application->update([
                'status' => \Modules\Hr\Recruitment\Domain\Enums\ApplicationStatus::OfferAccepted->value,
                'decided_at' => Carbon::now(),
                'decided_by' => $actorId,
            ]);

            if ($opening !== null) {
                $this->openings->recordHire($opening);
            }

            // The last line of the candidate's story, and the first of the
            // employee's — the two records meet here and nowhere else.
            $this->timeline->recordForApplication($application, \Modules\Hr\Recruitment\Domain\Enums\TimelineEventType::Hired, [
                'title' => 'Hired as '.$employee->employee_number,
                'summary' => 'Starting '.$hireDate,
                'subject_type' => 'employee',
                'subject_id' => (string) $employee->id,
                'context' => [
                    'employee_number' => (string) $employee->employee_number,
                    'hire_date' => $hireDate,
                    'department_id' => $employee->department_id,
                    'position_id' => $employee->position_id,
                ],
            ], $actorId);

            return $employee->refresh();
        });

        Event::dispatch(new ApplicantHired(
            companyId: (string) $application->company_id,
            applicantId: (string) $applicant->id,
            applicationId: (string) $application->id,
            employeeId: (string) $employee->id,
            employeeNumber: (string) $employee->employee_number,
            employeeName: $employee->fullName(),
            departmentId: $employee->department_id === null ? null : (string) $employee->department_id,
            positionId: $employee->position_id === null ? null : (string) $employee->position_id,
            hireDate: $hireDate,
            hiredAt: Carbon::now(),
        ));

        return $employee;
    }

    /**
     * What the hire form should be pre-filled with — everything already known,
     * so nobody retypes it.
     *
     * @return array<string, mixed>
     */
    public function prefillFor(JobApplication $application): array
    {
        $applicant = $application->applicant;
        $opening = $application->jobOpening;

        // If an offer was accepted, IT is what both sides agreed — it outranks the
        // advertised band and the candidate's original ask for every field it names.
        $offer = $this->offers->acceptedOfferFor($application);
        $agreed = $offer?->currentTerms();

        return [
            'applicant' => [
                'full_name' => $applicant->full_name ?? null,
                'mobile' => $applicant->mobile ?? null,
                'email' => $applicant->email ?? null,
                'birth_date' => $applicant?->birth_date?->toDateString(),
            ],
            'department_id' => $agreed?->department_id ?? $opening?->department_id,
            'position_id' => $agreed?->position_id ?? $opening?->position_id,
            'job_grade_id' => $opening?->job_grade_id,
            'employment_type_id' => $agreed?->employment_type_id ?? $opening?->employment_type_id,
            'branch_id' => $agreed?->branch_id ?? $opening?->branch_id,
            'reporting_manager_employee_id' => $opening?->hiring_manager_employee_id,
            // The agreed figures, so nobody retypes what was already signed off.
            'basic_salary' => $agreed === null ? null : (float) $agreed->basic_salary,
            'currency' => $agreed?->currency,
            'hire_date' => $agreed?->start_date?->toDateString(),
            'offer' => $offer === null ? null : [
                'id' => (string) $offer->id,
                'offer_number' => $offer->offer_number,
                'version' => (int) $offer->current_version,
                'accepted_at' => $offer->responded_at?->toDateTimeString(),
                'terms' => $agreed?->terms(),
            ],
            // The salary they asked for, and the band it was advertised in.
            'expected_salary' => $application->expected_salary === null ? null : (float) $application->expected_salary,
            'salary_range' => [
                'min' => $opening?->salary_min === null ? null : (float) $opening->salary_min,
                'max' => $opening?->salary_max === null ? null : (float) $opening->salary_max,
            ],
            'available_from' => $application->available_from?->toDateString(),
            // Both conditions, reported separately, so the UI can say WHICH one is
            // missing rather than greying a button out with no explanation.
            'can_hire' => $application->canBeHired() && $offer !== null,
            'blocked_by' => match (true) {
                ! $application->canBeHired() => 'The candidacy is '.$application->status->label().'; an accepted offer is required.',
                $offer === null => 'No accepted offer exists for this application.',
                default => null,
            },
        ];
    }

    private function carryDocumentsOver(JobApplication $application, Employee $employee, ?int $actorId): void
    {
        $attachments = $application->applicant?->attachments()->get() ?? collect();

        foreach ($attachments as $attachment) {
            $this->documents->attach($employee, [
                'type' => $attachment->type === 'cv'
                    ? EmployeeDocumentType::Qualification->value
                    : EmployeeDocumentType::Other->value,
                'title' => $attachment->title,
                'file_path' => $attachment->file_path,
                'file_name' => $attachment->file_name,
                'mime_type' => $attachment->mime_type,
                'file_size' => $attachment->file_size,
                'notes' => 'Carried over from application '.$application->application_number,
            ], $actorId);
        }
    }

    /** @return array{0: string, 1: string} */
    private function splitName(string $fullName): array
    {
        $parts = preg_split('/\s+/', trim($fullName)) ?: [];

        if (count($parts) <= 1) {
            return [$fullName !== '' ? $fullName : 'Unknown', '—'];
        }

        $first = array_shift($parts);

        return [(string) $first, implode(' ', $parts)];
    }
}
