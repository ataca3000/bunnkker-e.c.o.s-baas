<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;
use Modules\Logistics\Delivery\Domain\Enums\FailureReason;

/**
 * carrier vocabulary ⇄ ECOS vocabulary.
 *
 * DATA, not code: a new carrier status is mapped by configuration, and only
 * genuinely new BEHAVIOUR requires an adapter change. This is what keeps the
 * long tail of carrier quirks out of the core.
 */
class CarrierStatusMapping extends Model
{
    protected $table = 'carrier_status_mappings';

    protected $fillable = [
        'carrier_account_id', 'carrier_status',
        'delivery_status', 'failure_reason', 'description',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(CarrierAccount::class, 'carrier_account_id');
    }

    /** ECOS status, or null when the mapping is incomplete. */
    public function toDeliveryStatus(): ?DeliveryStatus
    {
        return $this->delivery_status !== null
            ? DeliveryStatus::tryFrom($this->delivery_status)
            : null;
    }

    public function toFailureReason(): ?FailureReason
    {
        return $this->failure_reason !== null
            ? FailureReason::tryFrom($this->failure_reason)
            : null;
    }

    public function isComplete(): bool
    {
        return $this->toDeliveryStatus() !== null;
    }
}
