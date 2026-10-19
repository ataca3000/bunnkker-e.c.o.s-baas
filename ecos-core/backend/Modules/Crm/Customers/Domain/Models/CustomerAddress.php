<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A customer address. Maps the EXISTING `customer_addresses` table — the CRM
 * Foundation reuses it (multiple addresses + a default already exist there)
 * rather than duplicating address storage.
 */
class CustomerAddress extends Model
{
    use HasUuids;

    protected $table = 'customer_addresses';

    protected $fillable = [
        'customer_id', 'label', 'governorate', 'city', 'area', 'address_line',
        'building', 'floor', 'apartment', 'landmark', 'address_notes',
        'google_maps_lat', 'google_maps_lng', 'google_maps_url', 'location_source', 'is_default',
    ];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
