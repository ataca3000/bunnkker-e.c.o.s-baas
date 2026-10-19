<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Modules\Hr\Compensation\Domain\Models\Payslip;
use Modules\Hr\Compensation\Domain\Models\PayslipLine;

/**
 * Every payslip line, shown with its working.
 *
 * ┌─ FORMULA · INPUTS · SOURCE · CALCULATION ───────────────────────────────┐
 * │ Four things for every line, in the same shape, whatever the line is:        │
 * │                                                                            │
 * │   Sales  12,500  ×  2%  =  250                                             │
 * │                                                                            │
 * │ The calculator already stores an explanation per line; what it did not have │
 * │ was ONE shape across all five kinds of line, so a screen could render them  │
 * │ uniformly. This is that shape, derived at read time — no second copy of the │
 * │ numbers is stored, so nothing here can drift from the payslip it explains.  │
 * │                                                                            │
 * │ Read-only, like the previews. It recalculates nothing and would be a bug if │
 * │ it did: a payslip is a frozen record, and an explanation that re-derived     │
 * │ figures could contradict the very document it is explaining.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class PayslipExplainerService
{
    /**
     * A payslip with every line explained.
     *
     * @return array<string, mixed>
     */
    public function explain(Payslip $payslip): array
    {
        $lines = $payslip->lines()->orderBy('sequence')->get();

        return [
            'payslip_id' => (string) $payslip->id,
            'payslip_number' => $payslip->payslip_number,
            'employee_id' => (string) $payslip->employee_id,
            'status' => $payslip->status,
            'currency' => $payslip->currency,
            'totals' => [
                'basic_salary' => (float) $payslip->basic_salary,
                'bonus_total' => (float) $payslip->bonus_total,
                'commission_total' => (float) $payslip->commission_total,
                'advance_total' => (float) $payslip->advance_total,
                'deduction_total' => (float) $payslip->deduction_total,
                'gross_salary' => (float) $payslip->gross_salary,
                'net_salary' => (float) $payslip->net_salary,
            ],
            'net_formula' => 'net = basic + bonus + commission − advances − approved deductions',
            'net_worked' => $this->workedNet($payslip),
            'lines' => $lines->map(fn (PayslipLine $line) => $this->explainLine($line))->all(),
            'payslip_explanation' => $payslip->explanation ?? [],
        ];
    }

    /**
     * One line: what it is, where it came from, and how it was worked out.
     *
     * @return array<string, mixed>
     */
    public function explainLine(PayslipLine $line): array
    {
        $explanation = $line->explanation ?? [];
        $amount = (float) $line->amount;
        $sign = (int) $line->sign;

        return [
            'id' => (string) $line->id,
            'sequence' => (int) $line->sequence,
            'category' => $line->category,
            'code' => $line->code,
            'label' => $line->label,
            'amount' => $amount,
            'sign' => $sign,
            // Signed, so a reader never has to know that "deduction" implies minus.
            'signed_amount' => round($amount * $sign, 2),
            'direction' => $sign >= 0 ? 'adds to pay' : 'reduces pay',

            'formula' => $this->formula($line, $explanation),
            'inputs' => $this->inputs($line, $explanation),
            'source' => $this->source($line, $explanation),
            'calculation' => $this->calculation($line, $explanation),

            // The raw stored explanation, unfiltered — the four fields above are a
            // reading of it, and anyone who wants the original can still have it.
            'raw_explanation' => $explanation,
        ];
    }

    // ── The four fields ───────────────────────────────────────────────────────

    /** @param array<string, mixed> $explanation */
    private function formula(PayslipLine $line, array $explanation): string
    {
        // Commission lines carry their own formula from the engine — that one is
        // authoritative, because the engine wrote it while doing the arithmetic.
        if (isset($explanation['formula'])) {
            return (string) $explanation['formula'];
        }

        return match ($line->category) {
            'basic' => 'amount = the basic salary of the structure in force on the period end',
            'bonus' => 'amount = the approved bonus amount',
            'advance' => 'amount = the installment due within the period',
            'deduction' => 'amount = the approved deduction amount',
            default => 'amount = as recorded',
        };
    }

    /**
     * The input values the figure was produced from.
     *
     * @param  array<string, mixed>  $explanation
     * @return array<int, array<string, mixed>>
     */
    private function inputs(PayslipLine $line, array $explanation): array
    {
        $inputs = [];

        $add = function (string $label, mixed $value, ?string $unit = null) use (&$inputs): void {
            if ($value === null || $value === '') {
                return;
            }

            $inputs[] = ['label' => $label, 'value' => $value, 'unit' => $unit];
        };

        // Commission — the measured metric and the rate that was applied to it.
        $add('Measured value', $explanation['measured_value'] ?? null);
        $add('Measured quantity', $explanation['measured_quantity'] ?? null);
        $add('Facts counted', $explanation['facts_counted'] ?? null);
        $add('Base', $explanation['base'] ?? null);
        $add('Rate', $explanation['rate'] ?? null, ($explanation['method'] ?? '') === 'amount_per_unit' ? 'per unit' : '%');
        $add('Threshold', $explanation['threshold'] ?? null);
        $add('Minimum', $explanation['min_amount'] ?? null);
        $add('Maximum', $explanation['max_amount'] ?? null);

        // Basic.
        $add('Effective from', $explanation['effective_from'] ?? null);
        $add('Pay frequency', $explanation['pay_frequency'] ?? null);

        // Bonus.
        $add('Awarded on', $explanation['awarded_on'] ?? null);

        // Advance.
        $add('Due date', $explanation['due_date'] ?? null);
        $add('Remaining after this installment', $explanation['remaining_after'] ?? null);

        // Deduction.
        $add('Decided at', $explanation['decided_at'] ?? null);

        if ($inputs === []) {
            $inputs[] = ['label' => 'Amount', 'value' => (float) $line->amount, 'unit' => null];
        }

        return $inputs;
    }

    /**
     * Where the figure came from, named rather than implied.
     *
     * @param  array<string, mixed>  $explanation
     * @return array<string, mixed>
     */
    private function source(PayslipLine $line, array $explanation): array
    {
        return [
            'type' => $line->source_type,
            'id' => $line->source_id,
            'label' => match ($line->source_type) {
                'salary_structure' => 'Salary structure',
                'bonus' => 'Approved bonus',
                'commission_rule' => 'Commission rule',
                'advance_installment' => 'Advance installment',
                'deduction' => 'Approved deduction',
                default => $line->source_type ?? 'Recorded manually',
            },
            // Commission lines reach further back — to the operational module that
            // published the facts the metric was measured from.
            'origin_module' => $explanation['metric'] ?? null,
            'source_module' => $explanation['source_module'] ?? null,
            'source_reference' => $explanation['source_reference'] ?? null,
            'approver' => $explanation['approver_id'] ?? null,
            'recommendation_id' => $explanation['recommendation_id'] ?? null,
        ];
    }

    /**
     * The arithmetic, written out.
     *
     * @param  array<string, mixed>  $explanation
     * @return array<string, mixed>
     */
    private function calculation(PayslipLine $line, array $explanation): array
    {
        $amount = round((float) $line->amount, 2);

        if (isset($explanation['base'], $explanation['rate'])) {
            $base = (float) $explanation['base'];
            $rate = (float) $explanation['rate'];
            $method = (string) ($explanation['method'] ?? '');

            $worked = $method === 'amount_per_unit'
                ? number_format($base, 2).' × '.$rate.' = '.number_format($amount, 2)
                : number_format($base, 2).' × '.$rate.'% = '.number_format($amount, 2);

            return [
                'worked' => $worked,
                'steps' => array_values(array_filter([
                    'Measured '.number_format($base, 2).' over the period',
                    isset($explanation['threshold']) && $explanation['threshold'] !== null
                        ? 'Threshold of '.$explanation['threshold'].($base >= (float) $explanation['threshold'] ? ' met' : ' not met')
                        : null,
                    'Applied '.$rate.($method === 'amount_per_unit' ? ' per unit' : '%'),
                    $explanation['note'] ?? null,
                    'Result '.number_format($amount, 2),
                ])),
                'result' => $amount,
            ];
        }

        return [
            'worked' => number_format($amount, 2),
            'steps' => array_values(array_filter([
                $explanation['note'] ?? null,
                'Result '.number_format($amount, 2),
            ])),
            'result' => $amount,
        ];
    }

    private function workedNet(Payslip $payslip): string
    {
        return number_format((float) $payslip->basic_salary, 2)
            .' + '.number_format((float) $payslip->bonus_total, 2)
            .' + '.number_format((float) $payslip->commission_total, 2)
            .' − '.number_format((float) $payslip->advance_total, 2)
            .' − '.number_format((float) $payslip->deduction_total, 2)
            .' = '.number_format((float) $payslip->net_salary, 2);
    }
}
