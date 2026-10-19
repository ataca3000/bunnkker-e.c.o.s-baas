<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Crm\Customers\Domain\Models\Customer;

/**
 * An immutable purchase fact — the atom every intelligence metric is built from.
 *
 * Fed by reference from Commerce/Finance (opaque `source_reference`); append-only,
 * so the intelligence layer is always reproducible from history.
 */
class PurchaseFact extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_purchase_facts';

    protected $fillable = [
        'company_id', 'customer_id', 'source_reference', 'source_type',
        'channel', 'amount', 'item_count', 'occurred_at', 'actor_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'item_count' => 'integer',
            'occurred_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /** Append-only: a recorded fact is never updated. */
    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }
}
