<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Ledger\Domain\Enums\JournalType;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Payables\Domain\Enums\PaymentStatus;
use Modules\Finance\Payables\Domain\Enums\SupplierDocumentType;
use Modules\Finance\Payables\Domain\Enums\SupplierLedgerEntryType;
use Modules\Finance\Payables\Domain\Models\SupplierBill;
use Modules\Finance\Payables\Domain\Models\SupplierBillLine;
use Modules\Finance\Payables\Domain\Models\SupplierLedgerEntry;
use Modules\Finance\Payables\Domain\Models\SupplierPayment;
use Modules\Finance\Posting\Domain\Services\PostingCoordinator;
use Modules\Finance\Shared\Domain\Enums\DocumentStatus;
use Modules\Finance\Shared\Domain\Services\ControlAccountResolver;
use Modules\Finance\Tax\Domain\Models\TaxCode;

/**
 * Accounts Payable — the supplier-facing subledger. The mirror of AR.
 *
 * Never writes the general ledger: posting a bill or a payment REQUESTS a
 * journal from the Posting Engine and records the supplier-ledger entry in the
 * same transaction. Payments carry an approval gate — money out is a two-person
 * decision.
 */
final class AccountsPayableService
{
    private const SOURCE_MODULE = 'finance.ap';

    public function __construct(
        private readonly PostingCoordinator $coordinator,
        private readonly ControlAccountResolver $controlAccounts,
    ) {}

    /**
     * Create a DRAFT supplier document (bill / credit note / debit note).
     *
     * @param  array<int, array{expense_account_id:int, description?:string, quantity?:float, unit_price?:float, net_amount?:float, tax_code_id?:int|null, cost_center_id?:int|null, branch_id?:string|null}>  $lines
     */
    public function createDocument(
        string $companyId,
        string $supplierId,
        string $number,
        Carbon $documentDate,
        array $lines,
        SupplierDocumentType $type = SupplierDocumentType::Bill,
        ?Carbon $dueDate = null,
        string $currency = 'EGP',
        ?string $description = null,
        ?int $createdBy = null,
    ): SupplierBill {
        if ($lines === []) {
            throw FinanceException::documentHasNoLines($type->label());
        }

        return DB::transaction(function () use (
            $companyId, $supplierId, $number, $documentDate, $lines, $type, $dueDate, $currency, $description, $createdBy
        ): SupplierBill {
            $bill = SupplierBill::create([
                'company_id' => $companyId,
                'supplier_id' => $supplierId,
                'document_type' => $type->value,
                'number' => $number,
                'bill_date' => $documentDate->toDateString(),
                'due_date' => $dueDate?->toDateString(),
                'currency' => $currency,
                'status' => DocumentStatus::Draft->value,
                'description' => $description,
                'created_by' => $createdBy,
            ]);

            $subtotal = 0.0;
            $taxTotal = 0.0;

            foreach ($lines as $raw) {
                $net = $this->lineNet($raw);
                $tax = $this->lineTax($raw, $net);

                SupplierBillLine::create([
                    'supplier_bill_id' => $bill->id,
                    'expense_account_id' => $raw['expense_account_id'],
                    'description' => $raw['description'] ?? null,
                    'quantity' => $raw['quantity'] ?? 1,
                    'unit_price' => $raw['unit_price'] ?? $net,
                    'net_amount' => $net,
                    'tax_code_id' => $raw['tax_code_id'] ?? null,
                    'tax_amount' => $tax,
                    'cost_center_id' => $raw['cost_center_id'] ?? null,
                    'branch_id' => $raw['branch_id'] ?? null,
                ]);

                $subtotal += $net;
                $taxTotal += $tax;
            }

            $bill->update([
                'subtotal' => round($subtotal, 4),
                'tax_total' => round($taxTotal, 4),
                'total' => round($subtotal + $taxTotal, 4),
            ]);

            return $bill->refresh();
        });
    }

    /** Post a supplier document and record its supplier-ledger entry. */
    public function postDocument(SupplierBill $bill, ?int $actorId = null): SupplierBill
    {
        $this->assertPostable($bill);

        $control = $this->controlAccounts->payable($bill->company_id);
        $bill->loadMissing('lines');

        $request = $this->buildDocumentPostingRequest($bill, (int) $control->id);

        return DB::transaction(function () use ($bill, $request, $control, $actorId): SupplierBill {
            $journal = $this->coordinator->post(
                self::SOURCE_MODULE,
                'bill:'.$bill->uuid,
                $request,
                null,
                $actorId,
            );

            $bill->update([
                'status' => DocumentStatus::Posted->value,
                'ap_control_account_id' => $control->id,
                'journal_entry_id' => $journal->id,
                'approved_by' => $actorId,
                'posted_at' => Carbon::now(),
            ]);

            $signed = round((float) $bill->total * $bill->document_type->payableSign(), 4);

            SupplierLedgerEntry::create([
                'company_id' => $bill->company_id,
                'supplier_id' => $bill->supplier_id,
                'entry_date' => $bill->bill_date->toDateString(),
                'entry_type' => $bill->document_type->ledgerEntryType()->value,
                'amount' => $signed,
                'source_type' => 'supplier_bill',
                'source_id' => $bill->uuid,
                'journal_entry_id' => $journal->id,
                'description' => $bill->document_type->label().' '.$bill->number,
            ]);

            return $bill->refresh();
        });
    }

    /** Create a DRAFT supplier payment (money out — awaits approval). */
    public function createPayment(
        string $companyId,
        string $supplierId,
        string $number,
        Carbon $paymentDate,
        float $amount,
        int $fundingAccountId,
        string $currency = 'EGP',
        ?string $description = null,
        ?int $createdBy = null,
    ): SupplierPayment {
        return SupplierPayment::create([
            'company_id' => $companyId,
            'supplier_id' => $supplierId,
            'number' => $number,
            'payment_date' => $paymentDate->toDateString(),
            'amount' => round($amount, 4),
            'funding_account_id' => $fundingAccountId,
            'currency' => $currency,
            'status' => PaymentStatus::Draft->value,
            'description' => $description,
            'created_by' => $createdBy,
        ]);
    }

    /**
     * Approve a draft payment. Segregation of duties: the approver may NOT be the
     * maker. Only an approved payment may post.
     */
    public function approvePayment(SupplierPayment $payment, int $approverId): SupplierPayment
    {
        if ($payment->status === PaymentStatus::Approved) {
            throw FinanceException::paymentAlreadyApproved($payment->number);
        }
        if ($payment->status !== PaymentStatus::Draft) {
            throw FinanceException::documentVoided('Payment', $payment->number);
        }
        if ((int) $payment->created_by === $approverId) {
            throw FinanceException::approverCannotBeMaker();
        }

        $payment->update([
            'status' => PaymentStatus::Approved->value,
            'approved_by' => $approverId,
            'approved_at' => Carbon::now(),
        ]);

        return $payment->refresh();
    }

    /**
     * Post an APPROVED payment: DR the AP control, CR the funding account — and
     * record the supplier-ledger entry (a negative movement: we owe less).
     */
    public function postPayment(SupplierPayment $payment, ?int $actorId = null): SupplierPayment
    {
        if ($payment->status === PaymentStatus::Posted) {
            throw FinanceException::documentAlreadyPosted('Payment', $payment->number);
        }
        if ($payment->status === PaymentStatus::Void) {
            throw FinanceException::documentVoided('Payment', $payment->number);
        }
        if ($payment->status !== PaymentStatus::Approved) {
            throw FinanceException::paymentNotApproved($payment->number);
        }

        $control = $this->controlAccounts->payable($payment->company_id);
        $amount = round((float) $payment->amount, 4);

        $request = new PostingRequest(
            companyId: $payment->company_id,
            entryDate: Carbon::parse($payment->payment_date),
            lines: [
                PostingLine::debit((int) $control->id, $amount, $payment->company_id),
                PostingLine::credit((int) $payment->funding_account_id, $amount, $payment->company_id),
            ],
            reference: $payment->number,
            description: 'Supplier payment '.$payment->number,
            source: 'posting',
            sourceModule: self::SOURCE_MODULE,
            sourceEventId: 'payment:'.$payment->uuid,
            journalType: JournalType::Cash->value,
        );

        return DB::transaction(function () use ($payment, $request, $control, $actorId, $amount): SupplierPayment {
            $journal = $this->coordinator->post(
                self::SOURCE_MODULE,
                'payment:'.$payment->uuid,
                $request,
                null,
                $actorId,
            );

            $payment->update([
                'status' => PaymentStatus::Posted->value,
                'ap_control_account_id' => $control->id,
                'journal_entry_id' => $journal->id,
                'posted_at' => Carbon::now(),
            ]);

            SupplierLedgerEntry::create([
                'company_id' => $payment->company_id,
                'supplier_id' => $payment->supplier_id,
                'entry_date' => $payment->payment_date->toDateString(),
                'entry_type' => SupplierLedgerEntryType::Payment->value,
                'amount' => round($amount * SupplierLedgerEntryType::Payment->sign(), 4),
                'source_type' => 'supplier_payment',
                'source_id' => $payment->uuid,
                'journal_entry_id' => $journal->id,
                'description' => 'Payment '.$payment->number,
            ]);

            return $payment->refresh();
        });
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function assertPostable(SupplierBill $bill): void
    {
        if ($bill->status === DocumentStatus::Posted) {
            throw FinanceException::documentAlreadyPosted($bill->document_type->label(), $bill->number);
        }
        if ($bill->status === DocumentStatus::Void) {
            throw FinanceException::documentVoided($bill->document_type->label(), $bill->number);
        }
        if ($bill->lines()->count() === 0) {
            throw FinanceException::documentHasNoLines($bill->document_type->label());
        }
    }

    /**
     * Natural direction is DR expense (net) / DR input tax (tax) / CR AP control
     * (total); a credit note flips every side.
     */
    private function buildDocumentPostingRequest(SupplierBill $bill, int $controlAccountId): PostingRequest
    {
        $sign = $bill->document_type->payableSign(); // +1 bill/debit, −1 credit note
        $companyId = $bill->company_id;
        $lines = [];

        $total = round((float) $bill->total, 4);
        // Control is CREDITED on a bill (we owe more) — so debit when sign < 0.
        $lines[] = $this->directional($controlAccountId, $total, $sign < 0, $companyId);

        $taxByAccount = [];
        foreach ($bill->lines as $line) {
            $net = round((float) $line->net_amount, 4);
            if ($net > 0.0) {
                $lines[] = $this->directional(
                    (int) $line->expense_account_id,
                    $net,
                    $sign >= 0, // expense is debited on a bill
                    $companyId,
                    [
                        'costCenterId' => $line->cost_center_id !== null ? (int) $line->cost_center_id : null,
                        'branchId' => $line->branch_id,
                        'description' => $line->description,
                    ],
                );
            }

            $tax = round((float) $line->tax_amount, 4);
            if ($tax > 0.0 && $line->tax_code_id !== null) {
                $taxCode = TaxCode::find($line->tax_code_id);
                $taxAccountId = $taxCode?->input_account_id;
                if ($taxAccountId !== null) {
                    $taxByAccount[$taxAccountId] = round(($taxByAccount[$taxAccountId] ?? 0.0) + $tax, 4);
                }
            }
        }

        foreach ($taxByAccount as $taxAccountId => $tax) {
            $lines[] = $this->directional((int) $taxAccountId, $tax, $sign >= 0, $companyId);
        }

        return new PostingRequest(
            companyId: $companyId,
            entryDate: Carbon::parse($bill->bill_date),
            lines: $lines,
            reference: $bill->number,
            description: $bill->document_type->label().' '.$bill->number,
            source: 'posting',
            sourceModule: self::SOURCE_MODULE,
            sourceEventId: 'bill:'.$bill->uuid,
            journalType: JournalType::Purchase->value,
        );
    }

    /** @param array<string,mixed> $dimensions */
    private function directional(int $accountId, float $amount, bool $debit, string $companyId, array $dimensions = []): PostingLine
    {
        return $debit
            ? PostingLine::debit($accountId, $amount, $companyId, $dimensions)
            : PostingLine::credit($accountId, $amount, $companyId, $dimensions);
    }

    /** @param array<string,mixed> $raw */
    private function lineNet(array $raw): float
    {
        if (isset($raw['net_amount'])) {
            return round((float) $raw['net_amount'], 4);
        }

        return round((float) ($raw['quantity'] ?? 1) * (float) ($raw['unit_price'] ?? 0), 4);
    }

    /** @param array<string,mixed> $raw */
    private function lineTax(array $raw, float $net): float
    {
        if (empty($raw['tax_code_id'])) {
            return 0.0;
        }

        $taxCode = TaxCode::find($raw['tax_code_id']);

        return $taxCode?->taxFor($net) ?? 0.0;
    }
}
