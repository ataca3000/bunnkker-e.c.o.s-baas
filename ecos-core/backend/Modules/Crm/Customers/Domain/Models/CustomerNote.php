<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An authored note on a customer. */
class CustomerNote extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_notes';

    protected $fillable = ['customer_id', 'body', 'is_pinned', 'author_id'];

    protected function casts(): array
    {
        return ['is_pinned' => 'boolean'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
