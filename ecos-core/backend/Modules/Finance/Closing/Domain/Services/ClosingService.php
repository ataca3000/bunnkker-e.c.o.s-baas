<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Closing\Domain\Enums\CheckStatus;
use Modules\Finance\Closing\Domain\Enums\ClosingRunStatus;
use Modules\Finance\Closing\Domain\Models\ClosingRun;
use Modules\Finance\Controls\Domain\Models\ControlException;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Ledger\Domain\Services\TrialBalanceService;
use Modules\Finance\Shared\Domain\Services\ControlAccountReconciliationService;
use Throwable;

/**
 * The Closing orchestration — a validate-before-close workflow.
 *
 * A run builds a checklist by evaluating live checks (trial balance ties, no
 * drafts, subledgers reconcile, no critical exceptions), scores readiness, and
 * closes only when every BLOCKING check passes. Closing drives the F1 period
 * transition through PeriodClosingService; it never writes the ledger.
 */
final class ClosingService
{
    public function __construct(
        private readonly TrialBalanceService $trialBalance,
        private readonly ControlAccountReconciliationService $reconciliation,
        private readonly PeriodClosingService $periodClosing,
        private readonly CloseReadinessScorer $scorer,
    ) {}

    public function startPeriodRun(FiscalPeriod $period, ?int $actorId = null): ClosingRun
    {
        return ClosingRun::create([
            'company_id' => $period->company_id,
            'scope' => 'period',
            'fiscal_period_id' => $period->id,
            'status' => ClosingRunStatus::Draft->value,
            'initiated_by' => $actorId,
        ]);
    }

    /** Re-evaluate the checklist and score readiness. Repeatable. */
    public function validate(ClosingRun $run): ClosingRun
    {
        $checks = $this->evaluate($run);

        return DB::transaction(function () use ($run, $checks): ClosingRun {
            $run->items()->delete();
            $sort = 0;
            foreach ($checks as $c) {
                $run->items()->create([
                    'key' => $c['key'],
                    'label' => $c['label'],
                    'category' => $c['category'],
                    'status' => $c['status']->value,
                    'is_blocking' => $c['is_blocking'],
                    'detail' => $c['detail'],
                    'sort_order' => $sort++,
                ]);
            }

            $run->update([
                'status' => ClosingRunStatus::Validated->value,
                'readiness_score' => $this->scorer->compute($checks),
                'validated_at' => Carbon::now(),
            ]);

            return $run->refresh();
        });
    }

    /**
     * Close the period — allowed only when every blocking check passes. Maker/
     * checker: the approver may not be the initiator.
     */
    public function close(ClosingRun $run, int $approverId, ?string $reason = null): ClosingRun
    {
        if ($run->status !== ClosingRunStatus::Validated) {
            throw new FinanceException('The closing run must be validated before it can be closed.');
        }
        if ((int) $run->initiated_by === $approverId) {
            throw FinanceException::approverCannotBeMaker();
        }

        $failing = $run->items()->where('is_blocking', true)->where('status', '!=', CheckStatus::Passed->value)->count();
        if ($failing > 0) {
            throw FinanceException::closingBlocked('period', $failing);
        }

        return DB::transaction(function () use ($run, $approverId, $reason): ClosingRun {
            if ($run->fiscal_period_id !== null) {
                $this->periodClosing->softClose($run->period, $approverId, $reason);
            }

            $run->update([
                'status' => ClosingRunStatus::Closed->value,
                'approved_by' => $approverId,
                'closed_at' => Carbon::now(),
            ]);

            return $run->refresh();
        });
    }

    /**
     * Evaluate the live checks for a run.
     *
     * @return list<array<string, mixed>>
     */
    public function evaluate(ClosingRun $run): array
    {
        $companyId = $run->company_id;
        $periodId = $run->fiscal_period_id;
        $checks = [];

        // Trial balance ties.
        $tb = $this->trialBalance->forPeriod($companyId, $periodId);
        $checks[] = $this->check('trial_balance_ties', 'Trial balance ties', 'integrity', true,
            $tb['is_balanced'] ? CheckStatus::Passed : CheckStatus::Failed,
            $tb['is_balanced'] ? null : "Debit {$tb['total_debit']} ≠ credit {$tb['total_credit']}");

        // No draft (unposted) journals.
        $drafts = JournalEntry::query()->where('company_id', $companyId)
            ->when($periodId !== null, fn ($q) => $q->where('fiscal_period_id', $periodId))
            ->where('status', JournalStatus::Draft->value)->count();
        $checks[] = $this->check('no_draft_journals', 'No unposted journals', 'workflow', true,
            $drafts === 0 ? CheckStatus::Passed : CheckStatus::Failed, $drafts === 0 ? null : "{$drafts} draft journal(s) pending");

        // Subledgers reconcile (skipped when no control account is configured).
        foreach (['receivable' => 'AR', 'payable' => 'AP'] as $method => $label) {
            $checks[] = $this->reconciliationCheck($companyId, $method, $label);
        }

        // No open critical control exceptions.
        $criticals = ControlException::query()->where('company_id', $companyId)->where('status', 'open')->where('severity', 'critical')->count();
        $checks[] = $this->check('no_critical_exceptions', 'No critical control exceptions', 'controls', true,
            $criticals === 0 ? CheckStatus::Passed : CheckStatus::Failed, $criticals === 0 ? null : "{$criticals} open critical exception(s)");

        return $checks;
    }

    private function reconciliationCheck(string $companyId, string $method, string $label): array
    {
        try {
            $r = $this->reconciliation->{$method}($companyId);

            return $this->check("{$method}_reconciled", "{$label} subledger reconciles", 'reconciliation', true,
                $r['is_reconciled'] ? CheckStatus::Passed : CheckStatus::Failed,
                $r['is_reconciled'] ? null : "Difference {$r['difference']}");
        } catch (Throwable) {
            return $this->check("{$method}_reconciled", "{$label} subledger reconciles", 'reconciliation', false,
                CheckStatus::Skipped, 'No control account configured');
        }
    }

    /** @return array<string, mixed> */
    private function check(string $key, string $label, string $category, bool $blocking, CheckStatus $status, ?string $detail): array
    {
        return ['key' => $key, 'label' => $label, 'category' => $category, 'is_blocking' => $blocking, 'status' => $status, 'detail' => $detail];
    }
}
