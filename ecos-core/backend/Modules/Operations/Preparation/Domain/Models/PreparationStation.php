<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Operations\Preparation\Domain\Enums\StationStatus;
use Modules\Operations\Preparation\Domain\Enums\StationType;

/**
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $name
 * @property string|null $name_ar
 * @property StationType $station_type
 * @property string|null $zone
 * @property int|null $capacity
 * @property StationStatus $status
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 * @property string|null $deleted_by
 */
class PreparationStation extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'preparation_stations';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'name',
        'name_ar',
        'station_type',
        'zone',
        'capacity',
        'status',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'station_type' => StationType::class,
            'status' => StationStatus::class,
            'capacity' => 'integer',
        ];
    }
}
