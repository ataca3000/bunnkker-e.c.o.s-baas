<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Fleet\Domain\Enums\InspectionKind;
use Modules\Logistics\Fleet\Domain\Enums\InspectionStatus;

/**
 * A performed inspection. Immutable once submitted.
 *
 * template_version is snapshotted so a two-year-old inspection reads exactly as
 * it was performed, even after the template has moved on.
 */
class Inspection extends Model
{
    protected $table = 'fleet_inspections';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => InspectionStatus::Draft->value,
        'has_critical_failure' => false,
        'failed_item_count' => 0,
    ];

    protected $fillable = [
        'uuid', 'fleet_unit_id', 'template_id', 'company_id', 'template_version',
        'status', 'kind', 'odometer_km',
        'performed_at', 'performed_by', 'submitted_at', 'reviewed_at', 'approved_by',
        'has_critical_failure', 'failed_item_count', 'notes', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'status' => InspectionStatus::class,
            'kind' => InspectionKind::class,
            'odometer_km' => 'decimal:1',
            'template_version' => 'integer',
            'failed_item_count' => 'integer',
            'has_critical_failure' => 'boolean',
            'performed_at' => 'datetime',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $inspection): void {
            if ($inspection->uuid === null) {
                $inspection->uuid = (string) Str::uuid();
            }
        });
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FleetUnit::class, 'fleet_unit_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(InspectionTemplate::class, 'template_id');
    }

    public function results(): HasMany
    {
        return $this->hasMany(InspectionResult::class, 'inspection_id');
    }

    public function defects(): HasMany
    {
        return $this->hasMany(Defect::class, 'inspection_id');
    }

    public function isImmutable(): bool
    {
        return $this->status->isImmutable();
    }

    public function isApproved(): bool
    {
        return $this->status === InspectionStatus::Approved;
    }

    /**
     * Separation of duties: someone who recorded a critical failure may not
     * also sign it off. Mirrors LOG-005's POD capture vs. validate split.
     */
    public function canBeApprovedBy(?int $userId): bool
    {
        if (! $this->has_critical_failure) {
            return true;
        }

        return $userId !== null && $userId !== $this->performed_by;
    }

    /** @return list<string> */
    public function failedItemLabels(): array
    {
        if (! $this->relationLoaded('results')) {
            $this->load('results');
        }

        return $this->results
            ->where('passed', false)
            ->pluck('item_label')
            ->values()
            ->all();
    }
}
