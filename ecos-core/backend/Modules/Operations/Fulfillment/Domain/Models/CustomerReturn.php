<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Commerce\Orders\Domain\Models\Order;

/**
 * @property string $id
 * @property string $company_id
 * @property string $order_id
 * @property string $return_number
 * @property string $status pending_inspection | accepted | rejected
 * @property string $return_reason
 * @property string|null $driver_notes
 * @property string|null $warehouse_notes
 * @property string|null $inspector_id
 * @property string|null $inspected_at
 * @property string|null $accepted_at
 * @property string|null $rejected_at
 * @property string|null $inventory_restored_at
 * @property string $recorded_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class CustomerReturn extends Model
{
    use HasUuids;

    protected $table = 'customer_returns';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'order_id',
        'return_number',
        'status',
        'return_reason',
        'driver_notes',
        'warehouse_notes',
        'inspector_id',
        'inspected_at',
        'accepted_at',
        'rejected_at',
        'inventory_restored_at',
        'recorded_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'inspected_at' => 'datetime',
            'accepted_at' => 'datetime',
            'rejected_at' => 'datetime',
            'inventory_restored_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    /** @return HasMany<CustomerReturnLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(CustomerReturnLine::class, 'customer_return_id');
    }

    public function isPendingInspection(): bool
    {
        return $this->status === 'pending_inspection';
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }
}
