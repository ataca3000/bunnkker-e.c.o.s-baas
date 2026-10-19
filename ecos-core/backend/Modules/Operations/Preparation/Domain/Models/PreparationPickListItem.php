<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Enums\PickListItemStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $pick_list_id
 * @property string $product_id
 * @property string $sku_snapshot
 * @property string $name_snapshot
 * @property string|null $warehouse_zone
 * @property string|null $shelf_location
 * @property float $quantity_to_pick
 * @property float $quantity_picked
 * @property PickListItemStatus $status
 * @property string|null $picked_by
 * @property \Carbon\Carbon|null $picked_at
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PreparationPickListItem extends Model
{
    use HasUuids;

    protected $table = 'preparation_pick_list_items';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'pick_list_id',
        'product_id',
        'sku_snapshot',
        'name_snapshot',
        'warehouse_zone',
        'shelf_location',
        'quantity_to_pick',
        'quantity_picked',
        'status',
        'picked_by',
        'picked_at',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => PickListItemStatus::class,
            'quantity_to_pick' => 'float',
            'quantity_picked' => 'float',
            'picked_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PreparationPickList, $this> */
    public function pickList(): BelongsTo
    {
        return $this->belongsTo(PreparationPickList::class, 'pick_list_id');
    }
}
