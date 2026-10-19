<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\ApprovalStatus;
use Modules\Hr\Compensation\Domain\Enums\BonusType;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\Bonus;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Bonuses — awarded, approved, and only then included in pay.
 *
 * Every write asks CompensationLockService whether the pay behind it has already
 * been approved. Once it has, the answer is an adjustment, not an edit (Part 7).
 *
 * A bonus also carries what the engine RECOMMENDED beside what a person actually
 * approved. The gap between those two numbers is the decision, and a record that
 * keeps only the outcome cannot show it (Part 6).
 */
final class BonusService
{
    public function __construct(private readonly CompensationLockService $lock) {}

    public function award(Employee $employee, array $data, ?int $actorId = null): Bonus
    {
        $amount = round((float) ($data['amount'] ?? 0), 2);

        if ($amount <= 0) {
            throw CompensationException::amountMustBePositive();
        }

        $type = ($data['type'] ?? null) instanceof BonusType
            ? $data['type']
            : (BonusType::tryFrom((string) ($data['type'] ?? '')) ?? BonusType::Discretionary);

        $awardedOn = $data['awarded_on'] ?? Carbon::now()->toDateString();

        $this->lock->assertEditable(
            (string) $employee->company_id,
            (string) $awardedOn,
            $data['payroll_period_id'] ?? null,
        );

        return Bonus::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'payroll_period_id' => $data['payroll_period_id'] ?? null,
            'type' => $type->value,
            'amount' => $amount,
            // What the engine proposed, frozen beside what was granted.
            'recommended_amount' => isset($data['recommended_amount'])
                ? round((float) $data['recommended_amount'], 2)
                : null,
            'currency' => $data['currency'] ?? 'EGP',
            'reason' => $data['reason'],
            'awarded_on' => $awardedOn,
            'status' => ApprovalStatus::Pending->value,
            'source' => $data['source'] ?? 'manual',
            'recommendation_id' => $data['recommendation_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $actorId,
        ]);
    }

    public function approve(Bonus $bonus, ?int $approverId = null, ?string $reason = null): Bonus
    {
        $this->assertTransition($bonus, ApprovalStatus::Approved);
        $this->assertEditable($bonus);

        $bonus->update([
            'status' => ApprovalStatus::Approved->value,
            'approved_by' => $approverId,
            'approved_at' => Carbon::now(),
            'approval_reason' => $reason,
        ]);

        return $bonus->refresh();
    }

    public function reject(Bonus $bonus, ?int $approverId = null, ?string $reason = null): Bonus
    {
        $this->assertTransition($bonus, ApprovalStatus::Rejected);
        $this->assertEditable($bonus);

        $bonus->update([
            'status' => ApprovalStatus::Rejected->value,
            'approved_by' => $approverId,
            'approved_at' => Carbon::now(),
            'approval_reason' => $reason,
        ]);

        return $bonus->refresh();
    }

    /**
     * The decision behind one bonus: proposed, granted, and the difference.
     *
     * @return array<string, mixed>
     */
    public function decisionAudit(Bonus $bonus): array
    {
        $approved = (float) $bonus->amount;
        $recommended = $bonus->recommended_amount === null ? null : (float) $bonus->recommended_amount;

        return [
            'bonus_id' => (string) $bonus->id,
            'recommended_amount' => $recommended,
            'approved_amount' => $approved,
            // Signed: positive means a person granted more than the engine proposed.
            'difference' => $recommended === null ? null : round($approved - $recommended, 2),
            'difference_percent' => $recommended === null || $recommended <= 0
                ? null
                : round((($approved - $recommended) / $recommended) * 100, 1),
            'followed_recommendation' => $recommended === null
                ? null
                : abs($approved - $recommended) < 0.01,
            'approval_reason' => $bonus->approval_reason,
            'approver' => $bonus->approved_by,
            'approval_date' => $bonus->approved_at?->toDateTimeString(),
            'status' => $bonus->status->value,
            'recommendation_id' => $bonus->recommendation_id,
            'source' => $bonus->source,
        ];
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, Bonus> */
    public function approvedFor(Employee $employee, ?string $periodId, string $from, string $to)
    {
        return Bonus::query()
            ->where('employee_id', $employee->id)
            ->approved()
            ->where(function ($q) use ($periodId, $from, $to): void {
                $q->whereBetween('awarded_on', [$from, $to]);
                if ($periodId !== null) {
                    $q->orWhere('payroll_period_id', $periodId);
                }
            })
            ->orderBy('awarded_on')
            ->get();
    }

    private function assertEditable(Bonus $bonus): void
    {
        $this->lock->assertEditable(
            (string) $bonus->company_id,
            $bonus->awarded_on?->toDateString(),
            $bonus->payroll_period_id === null ? null : (string) $bonus->payroll_period_id,
        );
    }

    private function assertTransition(Bonus $bonus, ApprovalStatus $target): void
    {
        if (! $bonus->status->canTransitionTo($target)) {
            throw CompensationException::invalidApprovalTransition($bonus->status->value, $target->value);
        }
    }
}
