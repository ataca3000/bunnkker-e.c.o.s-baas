<?php

declare(strict_types=1);

namespace Modules\Finance\Banking\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Banking\Domain\Models\BankAccount;
use Modules\Finance\Banking\Domain\Models\BankReconciliationRule;
use Modules\Finance\Banking\Domain\Models\BankStatement;
use Modules\Finance\Banking\Domain\Models\BankStatementLine;

/**
 * Banking — bank accounts, imported statements and matching rules.
 *
 * This service owns the bank-side data. It never writes the general ledger:
 * importing a statement records what the bank reported; matching (in the
 * reconciliation service) only links those lines to book movements. Booking a
 * genuinely new bank item (a fee, interest) is a separate cash/journal action.
 */
final class BankingService
{
    public function createAccount(
        string $companyId,
        string $name,
        int $glAccountId,
        ?string $bankName = null,
        ?string $accountNumber = null,
        ?string $iban = null,
        ?string $swift = null,
        string $currency = 'EGP',
    ): BankAccount {
        return BankAccount::create([
            'company_id' => $companyId,
            'name' => $name,
            'gl_account_id' => $glAccountId,
            'bank_name' => $bankName,
            'account_number' => $accountNumber,
            'iban' => $iban,
            'swift' => $swift,
            'currency' => $currency,
        ]);
    }

    /**
     * Import a bank statement and its lines in one transaction.
     *
     * @param  array<int, array{value_date:string|Carbon, amount:float, description?:string, external_reference?:string}>  $lines
     */
    public function importStatement(
        BankAccount $account,
        Carbon $statementDate,
        float $openingBalance,
        float $closingBalance,
        array $lines,
        ?string $reference = null,
        ?Carbon $periodStart = null,
        ?Carbon $periodEnd = null,
        ?int $createdBy = null,
    ): BankStatement {
        return DB::transaction(function () use (
            $account, $statementDate, $openingBalance, $closingBalance, $lines, $reference, $periodStart, $periodEnd, $createdBy
        ): BankStatement {
            $statement = BankStatement::create([
                'company_id' => $account->company_id,
                'bank_account_id' => $account->id,
                'reference' => $reference,
                'statement_date' => $statementDate->toDateString(),
                'period_start' => $periodStart?->toDateString(),
                'period_end' => $periodEnd?->toDateString(),
                'opening_balance' => round($openingBalance, 4),
                'closing_balance' => round($closingBalance, 4),
                'status' => 'imported',
                'created_by' => $createdBy,
            ]);

            foreach ($lines as $raw) {
                BankStatementLine::create([
                    'bank_statement_id' => $statement->id,
                    'company_id' => $account->company_id,
                    'value_date' => ($raw['value_date'] instanceof Carbon ? $raw['value_date'] : Carbon::parse($raw['value_date']))->toDateString(),
                    'description' => $raw['description'] ?? null,
                    'external_reference' => $raw['external_reference'] ?? null,
                    'amount' => round((float) $raw['amount'], 4),
                    'match_status' => 'unmatched',
                ]);
            }

            return $statement->refresh();
        });
    }

    public function createRule(
        string $companyId,
        string $name,
        string $matchValue,
        string $matchType = 'contains',
        string $matchField = 'description',
        ?int $bankAccountId = null,
        ?int $targetAccountId = null,
        int $priority = 100,
    ): BankReconciliationRule {
        return BankReconciliationRule::create([
            'company_id' => $companyId,
            'bank_account_id' => $bankAccountId,
            'name' => $name,
            'priority' => $priority,
            'match_type' => $matchType,
            'match_field' => $matchField,
            'match_value' => $matchValue,
            'target_account_id' => $targetAccountId,
            'is_active' => true,
        ]);
    }
}
