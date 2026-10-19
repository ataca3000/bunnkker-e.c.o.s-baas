<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Enums\ReservableType;
use Modules\Operations\Preparation\Domain\Enums\ReservationStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $preparation_wave_id
 * @property ReservableType $reservable_type
 * @property string $reservable_id
 * @property string $reservable_name_snapshot
 * @property float $quantity_reserved
 * @property ReservationStatus $status
 * @property \Carbon\Carbon|null $expires_at
 * @property \Carbon\Carbon|null $released_at
 * @property string|null $released_by
 * @property \Carbon\Carbon|null $consumed_at
 * @property string|null $consumed_by
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PreparationInventoryReservation extends Model
{
    use HasUuids;

    protected $table = 'preparation_inventory_reservations';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'preparation_wave_id',
        'reservable_type',
        'reservable_id',
        'reservable_name_snapshot',
        'quantity_reserved',
        'status',
        'expires_at',
        'released_at',
        'released_by',
        'consumed_at',
        'consumed_by',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'reservable_type' => ReservableType::class,
            'status' => ReservationStatus::class,
            'quantity_reserved' => 'float',
            'expires_at' => 'datetime',
            'released_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function isActive(): bool
    {
        return in_array($this->status, [ReservationStatus::Created, ReservationStatus::Updated], true);
    }

    /** @return BelongsTo<PreparationWave, $this> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
