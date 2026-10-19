<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Enums\PoolMovementType;

/**
 * Append-only audit log for prepared_products_pool quantity changes.
 * ULID primary key — no UUID trait.
 *
 * @property string $id
 * @property string $company_id
 * @property string $pool_entry_id
 * @property PoolMovementType $movement_type
 * @property float $quantity_moved
 * @property string|null $from_wave_id
 * @property string|null $to_wave_id
 * @property string|null $vehicle_id
 * @property string $actor_id
 * @property string $actor_type
 * @property string|null $notes
 * @property \Carbon\Carbon $recorded_at
 */
class PreparedPoolMovement extends Model
{
    protected $table = 'prepared_pool_movements';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'id',
        'company_id',
        'pool_entry_id',
        'movement_type',
        'quantity_moved',
        'from_wave_id',
        'to_wave_id',
        'vehicle_id',
        'actor_id',
        'actor_type',
        'notes',
        'recorded_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'movement_type' => PoolMovementType::class,
            'quantity_moved' => 'float',
            'recorded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PreparedProductsPool, $this> */
    public function poolEntry(): BelongsTo
    {
        return $this->belongsTo(PreparedProductsPool::class, 'pool_entry_id');
    }
}
