<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Receivables\Domain\Enums\CustomerDocumentType;
use Modules\Finance\Shared\Domain\Enums\DocumentStatus;

/**
 * A customer invoice / credit note / debit note (AR subledger document).
 *
 * ┌─ A SUBLEDGER DOCUMENT — NOT THE LEDGER ─────────────────────────────────┐
 * │ It records what a customer owes. Posting it asks the Posting Engine to   │
 * │ move the AR control account in the GL; AR never writes the ledger. Once   │
 * │ posted the document is frozen — corrections are credit/debit notes. There │
 * │ is no stored balance: settlement is derived from receipt allocations.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CustomerInvoice extends Model
{
    /** Financial identity, frozen the moment the document posts. */
    private const FROZEN_ONCE_POSTED = [
        'company_id', 'customer_id', 'document_type', 'number',
        'invoice_date', 'currency', 'subtotal', 'tax_total', 'total',
        'ar_control_account_id', 'journal_entry_id',
    ];

    protected $table = 'finance_customer_invoices';

    /** @var array<string, mixed> */
    protected $attributes = [
        'document_type' => 'invoice',
        'status' => 'draft',
        'currency' => 'EGP',
        'subtotal' => 0,
        'tax_total' => 0,
        'total' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'customer_id', 'document_type', 'number',
        'invoice_date', 'due_date', 'currency', 'subtotal', 'tax_total', 'total',
        'status', 'ar_control_account_id', 'journal_entry_id', 'description',
        'created_by', 'approved_by', 'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'document_type' => CustomerDocumentType::class,
            'status' => DocumentStatus::class,
            'invoice_date' => 'date',
            'due_date' => 'date',
            'subtotal' => 'decimal:4',
            'tax_total' => 'decimal:4',
            'total' => 'decimal:4',
            'posted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $doc): void {
            if ($doc->uuid === null) {
                $doc->uuid = (string) Str::uuid();
            }
        });

        // A posted document's financial identity can never change.
        static::updating(function (self $doc): bool {
            if ($doc->getRawOriginal('status') === DocumentStatus::Posted->value) {
                foreach (self::FROZEN_ONCE_POSTED as $frozen) {
                    if ($doc->isDirty($frozen)) {
                        return false;
                    }
                }
            }

            return true;
        });

        // Only a draft may be deleted; a posted document is permanent.
        static::deleting(static fn (self $doc): bool => $doc->status === DocumentStatus::Draft);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(CustomerInvoiceLine::class, 'customer_invoice_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(ReceiptAllocation::class, 'customer_invoice_id');
    }

    public function controlAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'ar_control_account_id');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    public function isPosted(): bool
    {
        return $this->status === DocumentStatus::Posted;
    }

    /** Σ of allocations settling this document — derived, never stored. */
    public function allocatedAmount(): float
    {
        return round((float) $this->allocations()->sum('amount'), 4);
    }

    /**
     * What remains open on this document. A credit note's total is a reduction,
     * so its "outstanding" is naturally negative until offset.
     */
    public function outstanding(): float
    {
        $signed = (float) $this->total * ($this->document_type?->receivableSign() ?? 1);

        return round($signed - $this->allocatedAmount(), 4);
    }
}
