<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $customer_id
 * @property string $label
 * @property string $governorate
 * @property string|null $city
 * @property string|null $area
 * @property string|null $address_line
 * @property string|null $building
 * @property string|null $floor
 * @property string|null $apartment
 * @property string|null $landmark
 * @property string|null $address_notes
 * @property float|null $google_maps_lat
 * @property float|null $google_maps_lng
 * @property string|null $google_maps_url
 * @property string|null $location_source
 * @property bool $is_default
 */
class CustomerAddress extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'customer_id',
        'label',
        'governorate',
        'city',
        'area',
        'address_line',
        'building',
        'floor',
        'apartment',
        'landmark',
        'address_notes',
        'google_maps_lat',
        'google_maps_lng',
        'google_maps_url',
        'location_source',
        'is_default',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'google_maps_lat' => 'float',
            'google_maps_lng' => 'float',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
