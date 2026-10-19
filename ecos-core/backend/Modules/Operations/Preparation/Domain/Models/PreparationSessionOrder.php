<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Auto-managed junction between a PreparationSession and an Order.
 *
 * Created automatically when:
 *  1. A session is created — all eligible orders for the warehouse are attached.
 *  2. A new order arrives for a warehouse that already has an active session today.
 *
 * detached_at is set when an order is cancelled or completed and should no
 * longer be prepared.
 *
 * @property string $id
 * @property string $preparation_session_id
 * @property string $order_id
 * @property string $order_number_snapshot
 * @property string|null $customer_name_snapshot
 * @property string|null $governorate_snapshot
 * @property string|null $area_snapshot
 * @property string $attachment_source auto|manual_supervisor|system_recovery
 * @property \Carbon\Carbon $attached_at
 * @property string|null $attached_by null = auto-attached
 * @property \Carbon\Carbon|null $detached_at
 * @property string|null $detached_by
 * @property string|null $detachment_reason
 */
class PreparationSessionOrder extends Model
{
    use HasUuids;

    protected $table = 'preparation_session_orders';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'preparation_session_id',
        'order_id',
        'order_number_snapshot',
        'customer_name_snapshot',
        'governorate_snapshot',
        'area_snapshot',
        'attachment_source',
        'attached_at',
        'attached_by',
        'detached_at',
        'detached_by',
        'detachment_reason',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'attached_at' => 'datetime',
        'detached_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(PreparationSession::class, 'preparation_session_id');
    }

    public function isActive(): bool
    {
        return $this->detached_at === null;
    }
}
