<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Immutable audit log entry for a single reservation state transition.
 *
 * @property string $id
 * @property string $order_id
 * @property string|null $from_status
 * @property string $to_status
 * @property string|null $reason
 * @property string|null $warehouse_id
 * @property string|null $vehicle_id
 * @property array|null $meta
 * @property int|null $actor_id
 * @property string|null $actor_type
 */
final class OrderReservationAudit extends Model
{
    use HasUuids;

    protected $table = 'order_reservation_audits';

    protected $fillable = [
        'order_id',
        'from_status',
        'to_status',
        'reason',
        'warehouse_id',
        'vehicle_id',
        'meta',
        'actor_id',
        'actor_type',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public static function record(
        string $orderId,
        ?string $fromStatus,
        string $toStatus,
        ?string $reason = null,
        ?string $warehouseId = null,
        ?string $vehicleId = null,
        ?array $meta = null,
        ?int $actorId = null,
        string $actorType = 'system',
    ): self {
        return self::create([
            'order_id' => $orderId,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'reason' => $reason,
            'warehouse_id' => $warehouseId,
            'vehicle_id' => $vehicleId,
            'meta' => $meta,
            'actor_id' => $actorId,
            'actor_type' => $actorType,
        ]);
    }
}
