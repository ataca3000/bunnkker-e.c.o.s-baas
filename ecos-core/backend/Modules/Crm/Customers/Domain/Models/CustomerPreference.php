<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One key/value preference for a customer. */
class CustomerPreference extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_preferences';

    protected $fillable = ['customer_id', 'key', 'value'];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
