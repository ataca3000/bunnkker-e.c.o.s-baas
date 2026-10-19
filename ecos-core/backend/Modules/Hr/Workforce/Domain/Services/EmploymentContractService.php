<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Workforce\Domain\Enums\ContractStatus;
use Modules\Hr\Workforce\Domain\Enums\ContractType;
use Modules\Hr\Workforce\Domain\Exceptions\WorkforceException;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Models\EmploymentContract;

/**
 * Employment contracts, and the rule that keeps them honest: an employee has at
 * most ONE active contract at a time. Without it, "what are this person's terms"
 * has more than one answer.
 */
final class EmploymentContractService
{
    public function issue(string $companyId, Employee $employee, array $data, ?int $actorId = null): EmploymentContract
    {
        $type = ($data['type'] ?? null) instanceof ContractType
            ? $data['type']
            : (ContractType::tryFrom((string) ($data['type'] ?? '')) ?? ContractType::Permanent);

        $start = Carbon::parse($data['start_date']);
        $end = isset($data['end_date']) && $data['end_date'] !== null ? Carbon::parse($data['end_date']) : null;

        if ($type->requiresEndDate() && $end === null) {
            throw WorkforceException::contractEndDateRequired($type->value);
        }

        if ($end !== null && $end->lessThan($start)) {
            throw WorkforceException::contractEndsBeforeItStarts();
        }

        return DB::transaction(fn (): EmploymentContract => EmploymentContract::create([
            'company_id' => $companyId,
            'employee_id' => $employee->id,
            'position_id' => $data['position_id'] ?? $employee->position_id,
            'job_grade_id' => $data['job_grade_id'] ?? $employee->job_grade_id,
            'employment_type_id' => $data['employment_type_id'] ?? $employee->employment_type_id,
            'contract_number' => $data['contract_number'] ?? $this->nextContractNumber($companyId),
            'type' => $type->value,
            'status' => ContractStatus::Draft->value,
            'start_date' => $start->toDateString(),
            'end_date' => $end?->toDateString(),
            'probation_end_date' => $data['probation_end_date'] ?? null,
            'weekly_hours' => $data['weekly_hours'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $actorId,
        ]));
    }

    /** Bring a draft into force. Refused while another contract is still active. */
    public function activate(EmploymentContract $contract): EmploymentContract
    {
        $this->assertTransition($contract, ContractStatus::Active);

        $hasActive = EmploymentContract::query()
            ->where('employee_id', $contract->employee_id)
            ->where('status', ContractStatus::Active->value)
            ->where('id', '!=', $contract->id)
            ->exists();

        if ($hasActive) {
            throw WorkforceException::employeeAlreadyHasActiveContract();
        }

        $contract->update([
            'status' => ContractStatus::Active->value,
            'activated_at' => Carbon::now(),
            'signed_at' => $contract->signed_at ?? Carbon::now(),
        ]);

        return $contract->refresh();
    }

    public function terminate(EmploymentContract $contract, string $reason): EmploymentContract
    {
        $this->assertTransition($contract, ContractStatus::Terminated);

        $contract->update([
            'status' => ContractStatus::Terminated->value,
            'terminated_at' => Carbon::now(),
            'termination_reason' => $reason,
        ]);

        return $contract->refresh();
    }

    public function expire(EmploymentContract $contract): EmploymentContract
    {
        $this->assertTransition($contract, ContractStatus::Expired);
        $contract->update(['status' => ContractStatus::Expired->value]);

        return $contract->refresh();
    }

    /**
     * Contracts running out inside the window — the renewals HR needs to see
     * before they lapse.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, EmploymentContract>
     */
    public function expiringWithin(string $companyId, int $days = 30)
    {
        $today = Carbon::now()->startOfDay();

        return EmploymentContract::query()
            ->with('employee')
            ->where('company_id', $companyId)
            ->where('status', ContractStatus::Active->value)
            ->whereNotNull('end_date')
            ->whereBetween('end_date', [$today->toDateString(), $today->copy()->addDays($days)->toDateString()])
            ->orderBy('end_date')
            ->get();
    }

    public function nextContractNumber(string $companyId): string
    {
        $last = EmploymentContract::query()
            ->where('company_id', $companyId)
            ->where('contract_number', 'like', 'CTR-%')
            ->orderByDesc('contract_number')
            ->value('contract_number');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'CTR-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function assertTransition(EmploymentContract $contract, ContractStatus $target): void
    {
        if (! $contract->status->canTransitionTo($target)) {
            throw WorkforceException::invalidContractTransition($contract->status->value, $target->value);
        }
    }
}
