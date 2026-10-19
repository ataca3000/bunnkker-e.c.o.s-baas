<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only event stream feeding both the internal timeline and the public
 * tracking page. `visibility` decides which audience sees a given entry.
 */
class TrackingEvent extends Model
{
    public const VISIBILITY_INTERNAL = 'internal';

    public const VISIBILITY_CUSTOMER = 'customer';

    protected $table = 'delivery_tracking_events';

    /** @var array<string, mixed> */
    protected $attributes = [
        'visibility' => self::VISIBILITY_INTERNAL,
    ];

    protected $fillable = [
        'delivery_id', 'attempt_id', 'event_type', 'visibility',
        'title', 'description', 'metadata',
        'gps_lat', 'gps_lng', 'actor_name', 'actor_id', 'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'gps_lat' => 'decimal:7',
            'gps_lng' => 'decimal:7',
            'occurred_at' => 'datetime',
        ];
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class, 'delivery_id');
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DeliveryAttempt::class, 'attempt_id');
    }

    public function isCustomerVisible(): bool
    {
        return $this->visibility === self::VISIBILITY_CUSTOMER;
    }
}
