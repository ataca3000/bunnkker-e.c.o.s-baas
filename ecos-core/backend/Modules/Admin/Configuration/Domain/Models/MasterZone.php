<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Permanent Egypt master zone — child of MasterGovernorate.
 * Seeded once; brand zones link back via master_zone_id.
 * code is permanent and immutable — set once, never changed.
 *
 * @property string $id
 * @property string $master_governorate_id
 * @property string $name
 * @property string|null $code
 * @property int $sort_order
 * @property bool $is_active
 * @property bool $is_archived
 * @property int|null $estimated_delivery_sla_hours
 * @property string|null $default_warehouse_id
 * @property string|null $default_logistics_hub
 * @property string|null $delivery_difficulty
 * @property int|null $priority
 * @property float|null $latitude
 * @property float|null $longitude
 * @property string|null $polygon_id
 * @property string|null $notes
 */
class MasterZone extends Model
{
    use HasUuids;

    protected $table = 'master_zones';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'master_governorate_id',
        'name',
        'code',
        'sort_order',
        'is_active',
        'is_archived',
        'estimated_delivery_sla_hours',
        'default_warehouse_id',
        'default_logistics_hub',
        'delivery_difficulty',
        'priority',
        'latitude',
        'longitude',
        'polygon_id',
        'notes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'is_archived' => 'boolean',
            'estimated_delivery_sla_hours' => 'integer',
            'priority' => 'integer',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    /** @return BelongsTo<MasterGovernorate, $this> */
    public function governorate(): BelongsTo
    {
        return $this->belongsTo(MasterGovernorate::class, 'master_governorate_id');
    }

    /** @return HasMany<DeliveryZone, $this> */
    public function brandZones(): HasMany
    {
        return $this->hasMany(DeliveryZone::class, 'master_zone_id');
    }
}
