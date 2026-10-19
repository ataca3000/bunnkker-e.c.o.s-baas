<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Loading\Domain\Enums\MovementType;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_inventory_item_id
 * @property string $vehicle_assignment_id
 * @property string $vehicle_id
 * @property string $product_id
 * @property \Carbon\Carbon $operational_date
 * @property MovementType $movement_type
 * @property float $quantity
 * @property string $reference_type
 * @property string $reference_id
 * @property string $actor_id
 * @property string $actor_type
 * @property string|null $notes
 * @property \Carbon\Carbon $recorded_at
 */
class VehicleInventoryMovement extends Model
{
    protected $table = 'vehicle_inventory_movements';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'id',
        'company_id',
        'vehicle_inventory_item_id',
        'vehicle_assignment_id',
        'vehicle_id',
        'product_id',
        'operational_date',
        'movement_type',
        'quantity',
        'reference_type',
        'reference_id',
        'actor_id',
        'actor_type',
        'notes',
        'recorded_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'movement_type' => MovementType::class,
            'operational_date' => 'date:Y-m-d',
            'quantity' => 'float',
            'recorded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VehicleInventoryItem, $this> */
    public function vehicleInventoryItem(): BelongsTo
    {
        return $this->belongsTo(VehicleInventoryItem::class, 'vehicle_inventory_item_id');
    }
}
