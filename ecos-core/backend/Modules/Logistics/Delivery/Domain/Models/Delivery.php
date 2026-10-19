<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Delivery\Domain\Enums\AttemptStatus;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;

/**
 * Delivery — the Delivery OS aggregate root.
 *
 * One order's journey to the customer, spanning every attempt across every
 * trip. Distribution's DeliveryStop is a per-trip planned visit and is
 * referenced read-only; this aggregate writes nothing in Distribution.
 *
 * Invariants:
 *  - at most one open attempt at a time
 *  - attempt count never exceeds max_attempts
 *  - terminal states are final
 */
class Delivery extends Model
{
    protected $table = 'delivery_deliveries';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => DeliveryStatus::Pending->value,
        'attempt_count' => 0,
        'max_attempts' => 3,
        'sla_breached' => false,
        'escalation_level' => 0,
        'requires_address_correction' => false,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'order_id', 'current_stop_id', 'status',
        'attempt_count', 'max_attempts', 'retry_cutoff_date',
        'promised_at', 'sla_grace_minutes', 'delivered_at',
        'sla_breached', 'escalation_level',
        'requires_address_correction', 'address_corrected_at',
        'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => DeliveryStatus::class,
            'attempt_count' => 'integer',
            'max_attempts' => 'integer',
            'escalation_level' => 'integer',
            'sla_grace_minutes' => 'integer',
            'sla_breached' => 'boolean',
            'requires_address_correction' => 'boolean',
            'retry_cutoff_date' => 'date:Y-m-d',
            'promised_at' => 'datetime',
            'delivered_at' => 'datetime',
            'address_corrected_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $delivery): void {
            if ($delivery->uuid === null) {
                $delivery->uuid = (string) Str::uuid();
            }
        });
    }

    // ── Relations ─────────────────────────────────────────────────────────────

    public function attempts(): HasMany
    {
        return $this->hasMany(DeliveryAttempt::class, 'delivery_id')->orderBy('attempt_no');
    }

    /** The single attempt still in flight, if any. */
    public function openAttempt(): HasOne
    {
        return $this->hasOne(DeliveryAttempt::class, 'delivery_id')
            ->whereNotIn('status', [
                AttemptStatus::Succeeded->value,
                AttemptStatus::Failed->value,
                AttemptStatus::Aborted->value,
            ]);
    }

    public function latestAttempt(): HasOne
    {
        return $this->hasOne(DeliveryAttempt::class, 'delivery_id')->latestOfMany('attempt_no');
    }

    public function failures(): HasMany
    {
        return $this->hasMany(DeliveryFailure::class, 'delivery_id')->latest();
    }

    public function pods(): HasMany
    {
        return $this->hasMany(ProofOfDelivery::class, 'delivery_id')->latest();
    }

    public function returns(): HasMany
    {
        return $this->hasMany(DeliveryReturn::class, 'delivery_id')->latest();
    }

    public function codRecord(): HasOne
    {
        return $this->hasOne(CodRecord::class, 'delivery_id')->latestOfMany();
    }

    public function trackingEvents(): HasMany
    {
        return $this->hasMany(TrackingEvent::class, 'delivery_id')->orderByDesc('occurred_at');
    }

    /** Read-only reference into Distribution. */
    public function currentStop(): BelongsTo
    {
        return $this->belongsTo(DeliveryStop::class, 'current_stop_id');
    }

    /** Read-only reference into Commerce for display (order number + customer snapshot). */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    // ── Domain logic ──────────────────────────────────────────────────────────

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    public function hasOpenAttempt(): bool
    {
        return $this->openAttempt()->exists();
    }

    public function remainingAttempts(): int
    {
        return max(0, $this->max_attempts - $this->attempt_count);
    }

    public function hasAttemptsRemaining(): bool
    {
        return $this->remainingAttempts() > 0;
    }

    public function isWithinRetryWindow(): bool
    {
        return $this->retry_cutoff_date === null
            || $this->retry_cutoff_date->gte(Carbon::today());
    }

    /**
     * Why this delivery may not be retried. Empty means it may.
     *
     * @return list<string>
     */
    public function retryBlockers(): array
    {
        $blockers = [];

        if ($this->isTerminal()) {
            $blockers[] = 'The delivery has already reached a terminal state.';
        }

        if (! $this->hasAttemptsRemaining()) {
            $blockers[] = "The retry limit of {$this->max_attempts} attempts has been reached.";
        }

        if (! $this->isWithinRetryWindow()) {
            $blockers[] = 'The retry cutoff date has passed.';
        }

        $lastFailure = $this->failures()->first();
        if ($lastFailure !== null && ! $lastFailure->is_retryable) {
            $blockers[] = "The last failure ({$lastFailure->reason_code->label()}) is not retryable.";
        }

        if ($this->requires_address_correction && $this->address_corrected_at === null) {
            $blockers[] = 'The address must be corrected before another attempt.';
        }

        $cod = $this->codRecord;
        if ($cod !== null && $cod->status->blocksClosure()) {
            $blockers[] = 'A disputed COD must be resolved first.';
        }

        return $blockers;
    }

    public function canRetry(): bool
    {
        return $this->retryBlockers() === [];
    }

    /** BR-27: three consecutive failures force manual review. */
    public function requiresManualReview(): bool
    {
        return $this->failures()->count() >= 3;
    }

    /** SLA breach is derived, never stored as the source of truth. */
    public function isSlaBreached(?Carbon $at = null): bool
    {
        if ($this->promised_at === null) {
            return false;
        }

        $deadline = $this->promised_at->copy()->addMinutes($this->sla_grace_minutes);
        $reference = $this->delivered_at ?? $at ?? Carbon::now();

        return $reference->gt($deadline);
    }

    public function minutesLate(): ?int
    {
        if ($this->promised_at === null || ! $this->isSlaBreached()) {
            return null;
        }

        $deadline = $this->promised_at->copy()->addMinutes($this->sla_grace_minutes);

        return (int) $deadline->diffInMinutes($this->delivered_at ?? Carbon::now(), false);
    }
}
