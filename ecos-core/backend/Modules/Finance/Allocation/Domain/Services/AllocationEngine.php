<?php

declare(strict_types=1);

namespace Modules\Finance\Allocation\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Payables\Domain\Models\PaymentAllocation;
use Modules\Finance\Payables\Domain\Models\SupplierBill;
use Modules\Finance\Payables\Domain\Models\SupplierPayment;
use Modules\Finance\Receivables\Domain\Models\CustomerInvoice;
use Modules\Finance\Receivables\Domain\Models\CustomerReceipt;
use Modules\Finance\Receivables\Domain\Models\ReceiptAllocation;

/**
 * The Allocation Engine — matches money to the documents it settles.
 *
 * ┌─ APPEND-ONLY MATCHING · DERIVED OUTSTANDING · NO GL WRITES ──────────────┐
 * │ Allocation is a pure subledger relationship: it never posts a journal.    │
 * │ The GL already moved when the receipt/payment and the invoice/bill posted; │
 * │ allocation only records WHICH open document a receipt settles. Every       │
 * │ balance — receipt remainder, invoice outstanding, on-account — is the SUM  │
 * │ of these rows, computed on read. Partial, full and multiple-document       │
 * │ matching all fall out of one guarded primitive.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class AllocationEngine
{
    // ── Accounts Receivable ─────────────────────────────────────────────────────

    /** Apply part (or all) of a posted receipt to one posted invoice. */
    public function allocateReceipt(
        CustomerReceipt $receipt,
        CustomerInvoice $invoice,
        float $amount,
        ?int $actorId = null,
    ): ReceiptAllocation {
        $amount = round($amount, 4);

        $this->assertPositive($amount);
        $this->assertPosted('Receipt', $receipt->number, $receipt->isPosted());
        $this->assertPosted($invoice->document_type->label(), $invoice->number, $invoice->isPosted());

        if ($receipt->customer_id !== $invoice->customer_id) {
            throw FinanceException::allocationPartyMismatch();
        }

        return DB::transaction(function () use ($receipt, $invoice, $amount, $actorId): ReceiptAllocation {
            // Re-derive availability inside the transaction to defeat races.
            $available = $receipt->fresh()->unallocatedAmount();
            if ($amount > $available) {
                throw FinanceException::allocationExceedsSource('receipt', (string) $available);
            }

            $outstanding = $invoice->fresh()->outstanding();
            if ($amount > $outstanding) {
                throw FinanceException::allocationExceedsDocument($invoice->document_type->label().' '.$invoice->number, (string) $outstanding);
            }

            return ReceiptAllocation::create([
                'company_id' => $receipt->company_id,
                'receipt_id' => $receipt->id,
                'customer_invoice_id' => $invoice->id,
                'amount' => $amount,
                'allocated_at' => Carbon::now(),
                'allocated_by' => $actorId,
            ]);
        });
    }

    /**
     * Auto-allocate a receipt across a customer's open invoices, oldest first
     * (FIFO). Stops when the receipt is exhausted; any remainder stays on
     * account. Returns the allocations created.
     *
     * @return list<ReceiptAllocation>
     */
    public function autoAllocateReceipt(CustomerReceipt $receipt, ?int $actorId = null): array
    {
        $receipt = $receipt->fresh();
        $remaining = $receipt->unallocatedAmount();
        if ($remaining <= 0.0) {
            return [];
        }

        $invoices = CustomerInvoice::query()
            ->where('company_id', $receipt->company_id)
            ->where('customer_id', $receipt->customer_id)
            ->where('status', 'posted')
            ->where('document_type', 'invoice')
            ->orderBy('due_date')
            ->orderBy('invoice_date')
            ->orderBy('id')
            ->get();

        $created = [];
        foreach ($invoices as $invoice) {
            if ($remaining <= 0.0) {
                break;
            }

            $outstanding = $invoice->outstanding();
            if ($outstanding <= 0.0) {
                continue;
            }

            $apply = round(min($remaining, $outstanding), 4);
            $created[] = $this->allocateReceipt($receipt, $invoice, $apply, $actorId);
            $remaining = round($remaining - $apply, 4);
        }

        return $created;
    }

    // ── Accounts Payable ────────────────────────────────────────────────────────

    /** Apply part (or all) of a posted payment to one posted bill. */
    public function allocatePayment(
        SupplierPayment $payment,
        SupplierBill $bill,
        float $amount,
        ?int $actorId = null,
    ): PaymentAllocation {
        $amount = round($amount, 4);

        $this->assertPositive($amount);
        $this->assertPosted('Payment', $payment->number, $payment->isPosted());
        $this->assertPosted($bill->document_type->label(), $bill->number, $bill->isPosted());

        if ($payment->supplier_id !== $bill->supplier_id) {
            throw FinanceException::allocationPartyMismatch();
        }

        return DB::transaction(function () use ($payment, $bill, $amount, $actorId): PaymentAllocation {
            $available = $payment->fresh()->unallocatedAmount();
            if ($amount > $available) {
                throw FinanceException::allocationExceedsSource('payment', (string) $available);
            }

            $outstanding = $bill->fresh()->outstanding();
            if ($amount > $outstanding) {
                throw FinanceException::allocationExceedsDocument($bill->document_type->label().' '.$bill->number, (string) $outstanding);
            }

            return PaymentAllocation::create([
                'company_id' => $payment->company_id,
                'payment_id' => $payment->id,
                'supplier_bill_id' => $bill->id,
                'amount' => $amount,
                'allocated_at' => Carbon::now(),
                'allocated_by' => $actorId,
            ]);
        });
    }

    /**
     * Auto-allocate a payment across a supplier's open bills, oldest first.
     *
     * @return list<PaymentAllocation>
     */
    public function autoAllocatePayment(SupplierPayment $payment, ?int $actorId = null): array
    {
        $payment = $payment->fresh();
        $remaining = $payment->unallocatedAmount();
        if ($remaining <= 0.0) {
            return [];
        }

        $bills = SupplierBill::query()
            ->where('company_id', $payment->company_id)
            ->where('supplier_id', $payment->supplier_id)
            ->where('status', 'posted')
            ->where('document_type', 'bill')
            ->orderBy('due_date')
            ->orderBy('bill_date')
            ->orderBy('id')
            ->get();

        $created = [];
        foreach ($bills as $bill) {
            if ($remaining <= 0.0) {
                break;
            }

            $outstanding = $bill->outstanding();
            if ($outstanding <= 0.0) {
                continue;
            }

            $apply = round(min($remaining, $outstanding), 4);
            $created[] = $this->allocatePayment($payment, $bill, $apply, $actorId);
            $remaining = round($remaining - $apply, 4);
        }

        return $created;
    }

    // ── Guards ──────────────────────────────────────────────────────────────────

    private function assertPositive(float $amount): void
    {
        if ($amount <= 0.0) {
            throw FinanceException::allocationMustBePositive();
        }
    }

    private function assertPosted(string $kind, string $number, bool $isPosted): void
    {
        if (! $isPosted) {
            throw FinanceException::documentNotPosted($kind, $number);
        }
    }
}
