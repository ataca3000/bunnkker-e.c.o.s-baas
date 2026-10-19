<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A line of a quote — a product referenced by opaque id plus a description. */
class QuoteLine extends Model
{
    use HasUuids;

    protected $table = 'crm_quote_lines';

    protected $fillable = ['quote_id', 'description', 'product_reference', 'quantity', 'unit_price', 'discount', 'line_total'];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:4', 'unit_price' => 'decimal:2', 'discount' => 'decimal:2', 'line_total' => 'decimal:2'];
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }
}
