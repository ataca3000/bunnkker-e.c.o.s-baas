<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Delivery\Domain\Enums\PodStatus;

/**
 * Customer-facing Proof of Delivery, owned by Delivery OS (CTO decision 2).
 *
 * `required_artifacts` is snapshotted at capture time so a later policy change
 * cannot retroactively invalidate a POD that was valid when it was taken.
 */
class ProofOfDelivery extends Model
{
    protected $table = 'delivery_pods';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => PodStatus::Pending->value,
    ];

    protected $fillable = [
        'uuid', 'delivery_id', 'attempt_id', 'status', 'required_artifacts',
        'recipient_name', 'notes',
        'captured_at', 'captured_by', 'validated_at', 'validated_by', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'status' => PodStatus::class,
            'required_artifacts' => 'array',
            'captured_at' => 'datetime',
            'validated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $pod): void {
            if ($pod->uuid === null) {
                $pod->uuid = (string) Str::uuid();
            }
        });
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class, 'delivery_id');
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DeliveryAttempt::class, 'attempt_id');
    }

    public function artifacts(): HasMany
    {
        return $this->hasMany(PodArtifact::class, 'pod_id');
    }

    public function isValidated(): bool
    {
        return $this->status->isValidated();
    }

    /** @return list<string> artifact kinds the policy demanded but that are absent */
    public function missingArtifacts(): array
    {
        $required = $this->required_artifacts ?? [];

        if ($required === []) {
            return [];
        }

        if (! $this->relationLoaded('artifacts')) {
            $this->load('artifacts');
        }

        $present = $this->artifacts->pluck('kind')->map(
            static fn ($k) => is_string($k) ? $k : $k->value
        )->all();

        return array_values(array_diff($required, $present));
    }

    /** BR-17: a POD may only be validated once every required artifact exists. */
    public function isComplete(): bool
    {
        return $this->missingArtifacts() === [];
    }
}
