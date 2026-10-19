<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Commerce\Fulfillments\Domain\Enums\FulfillmentStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;

/**
 * @property string $id
 * @property string $fulfillment_number
 * @property string $order_id
 * @property string $warehouse_id
 * @property string $fulfillment_date
 * @property FulfillmentStatus $status
 * @property string|null $notes
 */
class Fulfillment extends Model
{
    use HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'fulfillment_number',
        'order_id',
        'warehouse_id',
        'fulfillment_date',
        'status',
        'notes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => FulfillmentStatus::class,
            'fulfillment_date' => 'date:Y-m-d',
        ];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return HasMany<FulfillmentLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(FulfillmentLine::class);
    }
}
