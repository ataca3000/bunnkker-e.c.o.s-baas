<?php

declare(strict_types=1);

namespace Modules\Finance\Budget\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Budget\Domain\Enums\BudgetDimension;
use Modules\Finance\Budget\Domain\Enums\BudgetStatus;
use Modules\Finance\Budget\Domain\Models\Budget;
use Modules\Finance\Budget\Domain\Models\BudgetLine;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;

/**
 * Budget authoring — years, versions, scenarios, lines and the draft → approved
 * workflow. Budgets NEVER touch the ledger; this service only writes budget
 * tables. An approved budget is frozen; changes require a new version.
 */
final class BudgetService
{
    public function create(
        string $companyId,
        int $fiscalYearId,
        string $name,
        string $version = 'v1',
        string $scenario = 'base',
        string $currency = 'EGP',
        ?string $description = null,
        ?int $createdBy = null,
    ): Budget {
        return Budget::create([
            'company_id' => $companyId,
            'fiscal_year_id' => $fiscalYearId,
            'name' => $name,
            'version' => $version,
            'scenario' => $scenario,
            'currency' => $currency,
            'description' => $description,
            'status' => BudgetStatus::Draft->value,
            'created_by' => $createdBy,
        ]);
    }

    public function addLine(
        Budget $budget,
        int $accountId,
        float $amount,
        BudgetDimension $dimension = BudgetDimension::Company,
        ?string $dimensionId = null,
        ?int $periodNumber = null,
        ?string $notes = null,
    ): BudgetLine {
        if (! $budget->status->isEditable()) {
            throw FinanceException::budgetNotEditable();
        }

        return BudgetLine::create([
            'budget_id' => $budget->id,
            'account_id' => $accountId,
            'dimension_type' => $dimension->value,
            'dimension_id' => $dimensionId,
            'period_number' => $periodNumber,
            'amount' => round($amount, 4),
            'notes' => $notes,
        ]);
    }

    /**
     * Approve a budget — the baseline the control engine measures against.
     * Segregation of duties: the approver may not be the author.
     */
    public function approve(Budget $budget, int $approverId): Budget
    {
        if ($budget->status === BudgetStatus::Approved) {
            throw FinanceException::budgetAlreadyApproved($budget->name);
        }
        if ((int) $budget->created_by === $approverId) {
            throw FinanceException::approverCannotBeMaker();
        }

        $budget->update([
            'status' => BudgetStatus::Approved->value,
            'approved_by' => $approverId,
            'approved_at' => Carbon::now(),
        ]);

        return $budget->refresh();
    }

    /** Clone a budget's lines into a new draft version — how an approved plan is revised. */
    public function cloneAsVersion(Budget $budget, string $newVersion, ?int $createdBy = null): Budget
    {
        return DB::transaction(function () use ($budget, $newVersion, $createdBy): Budget {
            $clone = $this->create(
                companyId: $budget->company_id,
                fiscalYearId: (int) $budget->fiscal_year_id,
                name: $budget->name,
                version: $newVersion,
                scenario: $budget->scenario,
                currency: $budget->currency,
                description: $budget->description,
                createdBy: $createdBy,
            );

            foreach ($budget->lines as $line) {
                BudgetLine::create([
                    'budget_id' => $clone->id,
                    'account_id' => $line->account_id,
                    'dimension_type' => $line->dimension_type->value,
                    'dimension_id' => $line->dimension_id,
                    'period_number' => $line->period_number,
                    'amount' => $line->amount,
                    'notes' => $line->notes,
                ]);
            }

            return $clone->refresh();
        });
    }
}
