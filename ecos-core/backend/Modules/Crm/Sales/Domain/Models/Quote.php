<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Crm\Sales\Domain\Enums\QuoteStatus;

/** A quote — a proposal built from lines; totals are derived from them. */
class Quote extends Model
{
    use HasUuids;

    protected $table = 'crm_quotes';

    protected $fillable = [
        'company_id', 'customer_id', 'opportunity_id', 'quote_number', 'status', 'currency',
        'subtotal', 'discount', 'tax', 'total', 'valid_until', 'notes', 'sent_at', 'accepted_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => QuoteStatus::class,
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'tax' => 'decimal:2',
            'total' => 'decimal:2',
            'valid_until' => 'date',
            'sent_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(QuoteLine::class, 'quote_id');
    }
}
