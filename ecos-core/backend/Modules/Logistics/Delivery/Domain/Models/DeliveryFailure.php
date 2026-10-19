<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Delivery\Domain\Enums\FailureCategory;
use Modules\Logistics\Delivery\Domain\Enums\FailureReason;

/**
 * Structured failure record — immutable once written.
 *
 * Retryability is resolved from the reason at write time and stored, so the
 * decision that was actually applied stays auditable even if the taxonomy
 * later changes.
 */
class DeliveryFailure extends Model
{
    protected $table = 'delivery_failures';

    protected $fillable = [
        'delivery_id', 'attempt_id', 'reason_code', 'category',
        'is_retryable', 'requires_address_correction',
        'description', 'photos', 'reported_by',
    ];

    protected function casts(): array
    {
        return [
            'reason_code' => FailureReason::class,
            'category' => FailureCategory::class,
            'is_retryable' => 'boolean',
            'requires_address_correction' => 'boolean',
            'photos' => 'array',
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

    public function isCustomerFault(): bool
    {
        return $this->category === FailureCategory::Customer;
    }
}
