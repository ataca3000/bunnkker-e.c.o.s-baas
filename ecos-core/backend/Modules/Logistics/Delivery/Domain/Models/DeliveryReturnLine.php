<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-product return detail.
 *
 * BR-24: returned quantity may never exceed the undelivered quantity
 * (ordered − delivered). Enforced by the service before persistence.
 */
class DeliveryReturnLine extends Model
{
    protected $table = 'delivery_return_lines';

    /** @var array<string, mixed> */
    protected $attributes = [
        'ordered_qty' => 0,
        'delivered_qty' => 0,
        'returned_qty' => 0,
    ];

    protected $fillable = [
        'return_id', 'product_id', 'product_name',
        'ordered_qty', 'delivered_qty', 'returned_qty',
        'warehouse_confirmed_qty', 'discrepancy_qty', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'ordered_qty' => 'decimal:3',
            'delivered_qty' => 'decimal:3',
            'returned_qty' => 'decimal:3',
            'warehouse_confirmed_qty' => 'decimal:3',
            'discrepancy_qty' => 'decimal:3',
        ];
    }

    public function deliveryReturn(): BelongsTo
    {
        return $this->belongsTo(DeliveryReturn::class, 'return_id');
    }

    /** The quantity the customer never took. */
    public function undeliveredQty(): float
    {
        return round((float) $this->ordered_qty - (float) $this->delivered_qty, 3);
    }

    public function exceedsUndelivered(): bool
    {
        return (float) $this->returned_qty > $this->undeliveredQty() + 0.0001;
    }

    /** Declared minus counted. Positive means goods are missing. */
    public function calculateDiscrepancy(): ?float
    {
        if ($this->warehouse_confirmed_qty === null) {
            return null;
        }

        return round((float) $this->returned_qty - (float) $this->warehouse_confirmed_qty, 3);
    }

    public function hasDiscrepancy(): bool
    {
        $discrepancy = $this->calculateDiscrepancy();

        return $discrepancy !== null && abs($discrepancy) > 0.0001;
    }
}
