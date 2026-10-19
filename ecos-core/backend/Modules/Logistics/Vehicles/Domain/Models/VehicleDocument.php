<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleDocumentType;

/**
 * A file attached to a vehicle — licence, insurance, inspection or other.
 * Licence and insurance expiry gate dispatch (BR-7).
 */
class VehicleDocument extends Model
{
    protected $table = 'logistics_vehicle_documents';

    protected $fillable = [
        'uuid',
        'vehicle_id',
        'type',
        'title',
        'reference_number',
        'file_path',
        'file_name',
        'mime_type',
        'size_bytes',
        'issued_at',
        'expires_at',
        'notes',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => VehicleDocumentType::class,
            'issued_at' => 'date:Y-m-d',
            'expires_at' => 'date:Y-m-d',
            'size_bytes' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $document): void {
            if ($document->uuid === null) {
                $document->uuid = (string) Str::uuid();
            }
        });
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->lt(Carbon::today());
    }

    public function isExpiringSoon(): bool
    {
        if ($this->expires_at === null || $this->isExpired()) {
            return false;
        }

        return $this->expires_at->lte(Carbon::today()->addDays(Vehicle::EXPIRY_WARNING_DAYS));
    }

    public function daysUntilExpiry(): ?int
    {
        if ($this->expires_at === null) {
            return null;
        }

        return (int) Carbon::today()->diffInDays($this->expires_at, false);
    }

    public function blocksDispatchWhenExpired(): bool
    {
        return $this->type->blocksDispatchWhenExpired();
    }
}
