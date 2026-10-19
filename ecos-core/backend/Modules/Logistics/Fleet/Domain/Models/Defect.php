<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;
use Modules\Logistics\Fleet\Domain\Enums\DefectStatus;

/**
 * An open fault. A critical defect makes the vehicle unfit immediately.
 */
class Defect extends Model
{
    protected $table = 'fleet_defects';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => DefectStatus::Open->value,
        'severity' => DefectSeverity::Major->value,
    ];

    protected $fillable = [
        'uuid', 'fleet_unit_id', 'inspection_id', 'work_order_id', 'company_id',
        'status', 'severity', 'title', 'description', 'photos',
        'reported_at', 'reported_by', 'acknowledged_at',
        'resolved_at', 'resolved_by', 'dismissal_reason', 'dismissed_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => DefectStatus::class,
            'severity' => DefectSeverity::class,
            'photos' => 'array',
            'reported_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $defect): void {
            if ($defect->uuid === null) {
                $defect->uuid = (string) Str::uuid();
            }

            if ($defect->reported_at === null) {
                $defect->reported_at = now();
            }
        });
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FleetUnit::class, 'fleet_unit_id');
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(Inspection::class, 'inspection_id');
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class, 'work_order_id');
    }

    public function isOutstanding(): bool
    {
        return $this->status->isOutstanding();
    }

    public function blocksFitness(): bool
    {
        return $this->isOutstanding() && $this->severity->blocksFitness();
    }

    public function ageInDays(): int
    {
        return (int) $this->reported_at->diffInDays($this->resolved_at ?? now());
    }

    /** Dismissing a critical defect is an override and must carry a reason. */
    public function requiresOverrideToDismiss(): bool
    {
        return $this->severity->blocksFitness();
    }
}
