<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Services;

use Modules\Finance\Controls\Domain\Models\ControlException;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Shared\Domain\Services\ControlAccountReconciliationService;
use Modules\Finance\Vat\Domain\Models\VatPeriod;
use Throwable;

/**
 * The Financial Closing Workspace — the enterprise closing dashboard.
 *
 * A pure read model that aggregates everything a controller needs to judge a
 * close at a glance: checklist progress, open tasks, reconciliation status,
 * pending journals, budget status, VAT status, control exceptions and a single
 * close-readiness score. It reads; it never writes.
 */
final class ClosingWorkspaceService
{
    public function __construct(
        private readonly ClosingService $closing,
        private readonly CloseReadinessScorer $scorer,
        private readonly ControlAccountReconciliationService $reconciliation,
    ) {}

    /** @return array<string, mixed> */
    public function forPeriod(FiscalPeriod $period): array
    {
        $companyId = $period->company_id;

        // A transient run to evaluate the live checklist without persisting.
        $checks = $this->closing->evaluate($this->transientRun($period));
        $passed = count(array_filter($checks, fn ($c) => $c['status']->value === 'passed'));

        $pendingJournals = JournalEntry::query()
            ->where('company_id', $companyId)
            ->where('fiscal_period_id', $period->id)
            ->where('status', JournalStatus::Draft->value)
            ->count();

        $openExceptions = ControlException::query()->where('company_id', $companyId)->where('status', 'open')->get();
        $openVat = VatPeriod::query()->where('company_id', $companyId)->where('status', '!=', 'settled')->count();

        return [
            'period' => ['id' => $period->uuid, 'name' => $period->name, 'status' => $period->status->value],
            'closing_progress' => [
                'total' => count($checks),
                'passed' => $passed,
                'failed' => count(array_filter($checks, fn ($c) => $c['status']->value === 'failed')),
                'pct' => count($checks) > 0 ? round($passed / count($checks) * 100, 1) : 100.0,
            ],
            'open_tasks' => array_values(array_map(
                fn ($c) => ['key' => $c['key'], 'label' => $c['label'], 'detail' => $c['detail']],
                array_filter($checks, fn ($c) => $c['status']->value === 'failed'),
            )),
            'reconciliation_status' => $this->reconciliationStatus($companyId),
            'pending_journals' => $pendingJournals,
            'budget_status' => ['note' => 'See budget vs actual per approved budget.'],
            'vat_status' => ['open_periods' => $openVat],
            'control_exceptions' => [
                'open_total' => $openExceptions->count(),
                'critical' => $openExceptions->filter(fn ($e) => $e->severity->isBlocking())->count(),
            ],
            'close_readiness_score' => $this->scorer->compute($checks),
        ];
    }

    /** @return array<string, mixed> */
    private function reconciliationStatus(string $companyId): array
    {
        $out = [];
        foreach (['receivable', 'payable'] as $subledger) {
            try {
                $r = $this->reconciliation->{$subledger}($companyId);
                $out[$subledger] = ['reconciled' => $r['is_reconciled'], 'difference' => $r['difference']];
            } catch (Throwable) {
                $out[$subledger] = ['reconciled' => null, 'note' => 'not configured'];
            }
        }

        return $out;
    }

    private function transientRun(FiscalPeriod $period): \Modules\Finance\Closing\Domain\Models\ClosingRun
    {
        $run = new \Modules\Finance\Closing\Domain\Models\ClosingRun([
            'company_id' => $period->company_id,
            'scope' => 'period',
            'fiscal_period_id' => $period->id,
        ]);
        // Not saved — used only to carry context into evaluate().
        $run->fiscal_period_id = $period->id;
        $run->company_id = $period->company_id;

        return $run;
    }
}
