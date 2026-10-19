<?php

declare(strict_types=1);

namespace Modules\Finance\Controls\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Controls\Domain\Enums\ControlSeverity;
use Modules\Finance\Controls\Domain\Models\ControlException;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Ledger\Domain\Services\TrialBalanceService;
use Modules\Finance\Shared\Domain\Services\ControlAccountReconciliationService;
use Throwable;

/**
 * The Financial Validation Engine — the report-only control checks.
 *
 * ┌─ CONTROLS REPORT, THEY NEVER MODIFY ────────────────────────────────────┐
 * │ Every check reads Finance data and, when it finds a problem, OPENS an      │
 * │ exception in the register — it never edits a journal, a budget or a VAT    │
 * │ figure. Re-running is safe: an already-open exception is not duplicated    │
 * │ (the register de-dupes), and a problem that has cleared is auto-resolved.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class FinancialValidationEngine
{
    public function __construct(
        private readonly TrialBalanceService $trialBalance,
        private readonly ControlAccountReconciliationService $reconciliation,
    ) {}

    /**
     * Run every check for a company and reconcile the exception register.
     *
     * @return array<string, mixed>
     */
    public function run(string $companyId, ?int $fiscalPeriodId = null): array
    {
        $findings = [];
        $findings = array_merge($findings, $this->unbalancedJournals($companyId));
        $findings = array_merge($findings, $this->unpostedJournals($companyId));
        $findings = array_merge($findings, $this->trialBalanceCheck($companyId, $fiscalPeriodId));
        $findings = array_merge($findings, $this->subledgerReconciliation($companyId));

        $this->reconcileRegister($companyId, $fiscalPeriodId, $findings);

        return [
            'checks_run' => 4,
            'findings' => count($findings),
            'open_exceptions' => ControlException::query()->where('company_id', $companyId)->where('status', 'open')->count(),
            'by_severity' => $this->countBySeverity($companyId),
        ];
    }

    // ── Checks ──────────────────────────────────────────────────────────────────

    /** @return list<array<string, mixed>> */
    private function unbalancedJournals(string $companyId): array
    {
        $bad = JournalEntry::query()
            ->where('company_id', $companyId)
            ->whereIn('status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->withSum('lines as d', 'debit')
            ->withSum('lines as c', 'credit')
            ->get()
            ->filter(fn ($e) => round((float) $e->d, 4) !== round((float) $e->c, 4));

        return $bad->map(fn ($e) => $this->finding(
            'unbalanced_journal', ControlSeverity::Critical, 'integrity',
            'journal', (string) $e->uuid, "Journal {$e->uuid} is unbalanced (debit {$e->d} ≠ credit {$e->c}).",
        ))->values()->all();
    }

    /** @return list<array<string, mixed>> */
    private function unpostedJournals(string $companyId): array
    {
        return JournalEntry::query()
            ->where('company_id', $companyId)
            ->where('status', JournalStatus::Draft->value)
            ->get()
            ->map(fn ($e) => $this->finding(
                'unposted_journal', ControlSeverity::Warning, 'workflow',
                'journal', (string) $e->uuid, "Draft journal {$e->uuid} has not been posted.",
            ))->all();
    }

    /** @return list<array<string, mixed>> */
    private function trialBalanceCheck(string $companyId, ?int $fiscalPeriodId): array
    {
        $tb = $this->trialBalance->forPeriod($companyId, $fiscalPeriodId);
        if ($tb['is_balanced']) {
            return [];
        }

        return [$this->finding(
            'trial_balance_untied', ControlSeverity::Critical, 'integrity',
            null, null, "Trial balance does not tie: debit {$tb['total_debit']} ≠ credit {$tb['total_credit']}.",
        )];
    }

    /** @return list<array<string, mixed>> */
    private function subledgerReconciliation(string $companyId): array
    {
        $findings = [];
        foreach (['receivable', 'payable'] as $subledger) {
            try {
                $r = $this->reconciliation->{$subledger}($companyId);
                if (! $r['is_reconciled']) {
                    $findings[] = $this->finding(
                        'subledger_mismatch', ControlSeverity::Critical, 'reconciliation',
                        'control_account', (string) $r['control_account']['code'],
                        strtoupper($subledger).' subledger does not tie to its control account (difference '.$r['difference'].').',
                    );
                }
            } catch (Throwable) {
                // No control account configured — nothing to reconcile for this subledger.
            }
        }

        return $findings;
    }

    // ── Register reconciliation ───────────────────────────────────────────────

    /** @param list<array<string, mixed>> $findings */
    private function reconcileRegister(string $companyId, ?int $fiscalPeriodId, array $findings): void
    {
        $seen = [];
        foreach ($findings as $f) {
            $seen[$this->fingerprint($f)] = true;

            ControlException::query()->firstOrCreate(
                [
                    'company_id' => $companyId,
                    'check_key' => $f['check_key'],
                    'entity_type' => $f['entity_type'],
                    'entity_id' => $f['entity_id'],
                    'status' => 'open',
                ],
                [
                    'fiscal_period_id' => $fiscalPeriodId,
                    'category' => $f['category'],
                    'severity' => $f['severity']->value,
                    'message' => $f['message'],
                    'detected_at' => Carbon::now(),
                ],
            );
        }

        // Auto-resolve open exceptions whose problem has cleared.
        ControlException::query()
            ->where('company_id', $companyId)
            ->where('status', 'open')
            ->get()
            ->each(function (ControlException $e) use ($seen): void {
                $fp = $e->check_key.'|'.$e->entity_type.'|'.$e->entity_id;
                if (! isset($seen[$fp])) {
                    $e->update(['status' => 'resolved', 'resolved_at' => Carbon::now()]);
                }
            });
    }

    /** @return array<string, mixed> */
    private function finding(string $key, ControlSeverity $severity, string $category, ?string $entityType, ?string $entityId, string $message): array
    {
        return [
            'check_key' => $key,
            'severity' => $severity,
            'category' => $category,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'message' => $message,
        ];
    }

    /** @param array<string, mixed> $f */
    private function fingerprint(array $f): string
    {
        return $f['check_key'].'|'.$f['entity_type'].'|'.$f['entity_id'];
    }

    /** @return array<string, int> */
    private function countBySeverity(string $companyId): array
    {
        return ControlException::query()
            ->where('company_id', $companyId)
            ->where('status', 'open')
            ->selectRaw('severity, COUNT(*) as n')
            ->groupBy('severity')
            ->pluck('n', 'severity')
            ->all();
    }
}
