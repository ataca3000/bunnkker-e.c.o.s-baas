<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Ledger\Domain\Enums\JournalType;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Posting\Domain\Services\PostingCoordinator;
use Modules\Finance\Receivables\Domain\Enums\CustomerDocumentType;
use Modules\Finance\Receivables\Domain\Enums\CustomerLedgerEntryType;
use Modules\Finance\Receivables\Domain\Models\CustomerInvoice;
use Modules\Finance\Receivables\Domain\Models\CustomerInvoiceLine;
use Modules\Finance\Receivables\Domain\Models\CustomerLedgerEntry;
use Modules\Finance\Receivables\Domain\Models\CustomerReceipt;
use Modules\Finance\Shared\Domain\Enums\DocumentStatus;
use Modules\Finance\Shared\Domain\Services\ControlAccountResolver;
use Modules\Finance\Tax\Domain\Models\TaxCode;

/**
 * Accounts Receivable — the customer-facing subledger.
 *
 * ┌─ NEVER WRITES THE GENERAL LEDGER ───────────────────────────────────────┐
 * │ It owns AR documents and the customer ledger. When a document posts it    │
 * │ REQUESTS a journal from the Posting Engine (source = posting, so the AR    │
 * │ control account is reachable) and records the resulting customer-ledger    │
 * │ entry in the SAME transaction. The ledger stays the Journal Engine's       │
 * │ alone; the customer ledger reconciles to the AR control by construction.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class AccountsReceivableService
{
    private const SOURCE_MODULE = 'finance.ar';

    public function __construct(
        private readonly PostingCoordinator $coordinator,
        private readonly ControlAccountResolver $controlAccounts,
    ) {}

    /**
     * Create a DRAFT customer document (invoice / credit note / debit note) with
     * its lines. Nothing touches the ledger yet.
     *
     * @param  array<int, array{revenue_account_id:int, description?:string, quantity?:float, unit_price?:float, net_amount?:float, tax_code_id?:int|null, cost_center_id?:int|null, branch_id?:string|null}>  $lines
     */
    public function createDocument(
        string $companyId,
        string $customerId,
        string $number,
        Carbon $documentDate,
        array $lines,
        CustomerDocumentType $type = CustomerDocumentType::Invoice,
        ?Carbon $dueDate = null,
        string $currency = 'EGP',
        ?string $description = null,
        ?int $createdBy = null,
    ): CustomerInvoice {
        if ($lines === []) {
            throw FinanceException::documentHasNoLines($type->label());
        }

        return DB::transaction(function () use (
            $companyId, $customerId, $number, $documentDate, $lines, $type, $dueDate, $currency, $description, $createdBy
        ): CustomerInvoice {
            $invoice = CustomerInvoice::create([
                'company_id' => $companyId,
                'customer_id' => $customerId,
                'document_type' => $type->value,
                'number' => $number,
                'invoice_date' => $documentDate->toDateString(),
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

                CustomerInvoiceLine::create([
                    'customer_invoice_id' => $invoice->id,
                    'revenue_account_id' => $raw['revenue_account_id'],
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

            $invoice->update([
                'subtotal' => round($subtotal, 4),
                'tax_total' => round($taxTotal, 4),
                'total' => round($subtotal + $taxTotal, 4),
            ]);

            return $invoice->refresh();
        });
    }

    /**
     * Post a customer document to the ledger, exactly once, and record its
     * customer-ledger entry. Idempotent: re-posting returns the same journal.
     */
    public function postDocument(CustomerInvoice $invoice, ?int $actorId = null): CustomerInvoice
    {
        $this->assertPostable($invoice);

        $control = $this->controlAccounts->receivable($invoice->company_id);
        $invoice->loadMissing('lines');

        $request = $this->buildDocumentPostingRequest($invoice, (int) $control->id);

        return DB::transaction(function () use ($invoice, $request, $control, $actorId): CustomerInvoice {
            $journal = $this->coordinator->post(
                self::SOURCE_MODULE,
                'invoice:'.$invoice->uuid,
                $request,
                null,
                $actorId,
            );

            $invoice->update([
                'status' => DocumentStatus::Posted->value,
                'ar_control_account_id' => $control->id,
                'journal_entry_id' => $journal->id,
                'approved_by' => $actorId,
                'posted_at' => Carbon::now(),
            ]);

            // Customer ledger entry — signed by document type, linked to the GL.
            $signed = round((float) $invoice->total * $invoice->document_type->receivableSign(), 4);

            CustomerLedgerEntry::create([
                'company_id' => $invoice->company_id,
                'customer_id' => $invoice->customer_id,
                'entry_date' => $invoice->invoice_date->toDateString(),
                'entry_type' => $invoice->document_type->ledgerEntryType()->value,
                'amount' => $signed,
                'source_type' => 'customer_invoice',
                'source_id' => $invoice->uuid,
                'journal_entry_id' => $journal->id,
                'description' => $invoice->document_type->label().' '.$invoice->number,
            ]);

            return $invoice->refresh();
        });
    }

    /** Create a DRAFT customer receipt (money in). */
    public function createReceipt(
        string $companyId,
        string $customerId,
        string $number,
        Carbon $receiptDate,
        float $amount,
        int $depositAccountId,
        string $currency = 'EGP',
        ?string $description = null,
        ?int $createdBy = null,
    ): CustomerReceipt {
        return CustomerReceipt::create([
            'company_id' => $companyId,
            'customer_id' => $customerId,
            'number' => $number,
            'receipt_date' => $receiptDate->toDateString(),
            'amount' => round($amount, 4),
            'deposit_account_id' => $depositAccountId,
            'currency' => $currency,
            'status' => DocumentStatus::Draft->value,
            'description' => $description,
            'created_by' => $createdBy,
        ]);
    }

    /**
     * Post a receipt: DR the deposit account, CR the AR control — and record the
     * customer-ledger entry (a negative movement: the customer owes less).
     */
    public function postReceipt(
        CustomerReceipt $receipt,
        ?int $actorId = null,
        CustomerLedgerEntryType $ledgerType = CustomerLedgerEntryType::Receipt,
    ): CustomerReceipt {
        if ($receipt->status === DocumentStatus::Posted) {
            throw FinanceException::documentAlreadyPosted('Receipt', $receipt->number);
        }
        if ($receipt->status === DocumentStatus::Void) {
            throw FinanceException::documentVoided('Receipt', $receipt->number);
        }

        $control = $this->controlAccounts->receivable($receipt->company_id);
        $amount = round((float) $receipt->amount, 4);

        $request = new PostingRequest(
            companyId: $receipt->company_id,
            entryDate: Carbon::parse($receipt->receipt_date),
            lines: [
                PostingLine::debit((int) $receipt->deposit_account_id, $amount, $receipt->company_id),
                PostingLine::credit((int) $control->id, $amount, $receipt->company_id),
            ],
            reference: $receipt->number,
            description: 'Customer receipt '.$receipt->number,
            source: 'posting',
            sourceModule: self::SOURCE_MODULE,
            sourceEventId: 'receipt:'.$receipt->uuid,
            journalType: JournalType::Cash->value,
        );

        return DB::transaction(function () use ($receipt, $request, $control, $actorId, $amount, $ledgerType): CustomerReceipt {
            $journal = $this->coordinator->post(
                self::SOURCE_MODULE,
                'receipt:'.$receipt->uuid,
                $request,
                null,
                $actorId,
            );

            $receipt->update([
                'status' => DocumentStatus::Posted->value,
                'ar_control_account_id' => $control->id,
                'journal_entry_id' => $journal->id,
                'approved_by' => $actorId,
                'posted_at' => Carbon::now(),
            ]);

            CustomerLedgerEntry::create([
                'company_id' => $receipt->company_id,
                'customer_id' => $receipt->customer_id,
                'entry_date' => $receipt->receipt_date->toDateString(),
                'entry_type' => $ledgerType->value,
                'amount' => round($amount * $ledgerType->sign(), 4),
                'source_type' => 'customer_receipt',
                'source_id' => $receipt->uuid,
                'journal_entry_id' => $journal->id,
                'description' => ($ledgerType === CustomerLedgerEntryType::WriteOff ? 'Write-off ' : 'Receipt ').$receipt->number,
            ]);

            return $receipt->refresh();
        });
    }

    /**
     * Write off the outstanding balance of a posted invoice. A write-off is a
     * settlement funded by a bad-debt expense account: DR bad debt, CR AR
     * control. It is modelled as a receipt whose deposit account is the expense
     * account, then allocated to the invoice — so outstanding stays a pure
     * derivation and the control account is relieved exactly once.
     */
    public function writeOff(
        CustomerInvoice $invoice,
        int $badDebtAccountId,
        \Modules\Finance\Allocation\Domain\Services\AllocationEngine $allocations,
        ?float $amount = null,
        ?int $actorId = null,
        ?string $reason = null,
    ): CustomerReceipt {
        if (! $invoice->isPosted()) {
            throw FinanceException::documentNotPosted('Invoice', $invoice->number);
        }

        $outstanding = $invoice->outstanding();
        $writeOff = round($amount ?? $outstanding, 4);

        if ($writeOff <= 0.0) {
            throw FinanceException::allocationMustBePositive();
        }
        if ($writeOff > $outstanding) {
            throw FinanceException::allocationExceedsDocument('Invoice '.$invoice->number, (string) $outstanding);
        }

        return DB::transaction(function () use ($invoice, $badDebtAccountId, $allocations, $writeOff, $actorId, $reason): CustomerReceipt {
            $receipt = $this->createReceipt(
                companyId: $invoice->company_id,
                customerId: $invoice->customer_id,
                number: 'WO-'.$invoice->number,
                receiptDate: Carbon::today(),
                amount: $writeOff,
                depositAccountId: $badDebtAccountId,
                currency: $invoice->currency,
                description: $reason ?? ('Write-off of invoice '.$invoice->number),
                createdBy: $actorId,
            );

            $this->postReceipt($receipt, $actorId, CustomerLedgerEntryType::WriteOff);
            $allocations->allocateReceipt($receipt->refresh(), $invoice, $writeOff, $actorId);

            return $receipt->refresh();
        });
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function assertPostable(CustomerInvoice $invoice): void
    {
        if ($invoice->status === DocumentStatus::Posted) {
            throw FinanceException::documentAlreadyPosted($invoice->document_type->label(), $invoice->number);
        }
        if ($invoice->status === DocumentStatus::Void) {
            throw FinanceException::documentVoided($invoice->document_type->label(), $invoice->number);
        }
        if ($invoice->lines()->count() === 0) {
            throw FinanceException::documentHasNoLines($invoice->document_type->label());
        }
    }

    /**
     * Build the balanced posting for a customer document. Natural direction is
     * DR AR control (total) / CR revenue (net) / CR output tax (tax); a credit
     * note flips every side.
     */
    private function buildDocumentPostingRequest(CustomerInvoice $invoice, int $controlAccountId): PostingRequest
    {
        $sign = $invoice->document_type->receivableSign(); // +1 invoice/debit, −1 credit note
        $companyId = $invoice->company_id;
        $lines = [];

        // Control account carries the gross total.
        $total = round((float) $invoice->total, 4);
        $lines[] = $this->directional($controlAccountId, $total, $sign >= 0, $companyId);

        // Revenue per line (credited on an invoice), with its dimensions.
        $taxByAccount = [];
        foreach ($invoice->lines as $line) {
            $net = round((float) $line->net_amount, 4);
            if ($net > 0.0) {
                $lines[] = $this->directional(
                    (int) $line->revenue_account_id,
                    $net,
                    $sign < 0, // revenue is credited when control is debited
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
                $taxAccountId = $taxCode?->output_account_id;
                if ($taxAccountId !== null) {
                    $taxByAccount[$taxAccountId] = round(($taxByAccount[$taxAccountId] ?? 0.0) + $tax, 4);
                }
            }
        }

        foreach ($taxByAccount as $taxAccountId => $tax) {
            $lines[] = $this->directional((int) $taxAccountId, $tax, $sign < 0, $companyId);
        }

        return new PostingRequest(
            companyId: $companyId,
            entryDate: Carbon::parse($invoice->invoice_date),
            lines: $lines,
            reference: $invoice->number,
            description: $invoice->document_type->label().' '.$invoice->number,
            source: 'posting',
            sourceModule: self::SOURCE_MODULE,
            sourceEventId: 'invoice:'.$invoice->uuid,
            journalType: JournalType::Sales->value,
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
