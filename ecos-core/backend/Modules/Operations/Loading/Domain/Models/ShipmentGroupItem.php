<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $company_id
 * @property string $shipment_group_id
 * @property string $vehicle_assignment_id
 * @property string $loading_session_id
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class ShipmentGroupItem extends Model
{
    use HasUuids;

    protected $table = 'shipment_group_items';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'shipment_group_id',
        'vehicle_assignment_id',
        'loading_session_id',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [];
    }

    /** @return BelongsTo<ShipmentGroup, $this> */
    public function shipmentGroup(): BelongsTo
    {
        return $this->belongsTo(ShipmentGroup::class, 'shipment_group_id');
    }

    /** @return BelongsTo<VehicleAssignment, $this> */
    public function vehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(VehicleAssignment::class, 'vehicle_assignment_id');
    }
}
