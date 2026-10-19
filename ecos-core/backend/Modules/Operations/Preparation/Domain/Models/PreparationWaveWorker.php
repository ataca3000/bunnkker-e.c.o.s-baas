<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Enums\WorkerRole;

/**
 * @property string $id
 * @property string $company_id
 * @property string $preparation_wave_id
 * @property string $user_id
 * @property WorkerRole $role
 * @property \Carbon\Carbon $assigned_at
 * @property string $assigned_by
 * @property \Carbon\Carbon|null $released_at
 * @property string|null $released_by
 */
class PreparationWaveWorker extends Model
{
    use HasUuids;

    protected $table = 'preparation_wave_workers';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'preparation_wave_id',
        'user_id',
        'role',
        'assigned_at',
        'assigned_by',
        'released_at',
        'released_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'role' => WorkerRole::class,
            'assigned_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->released_at === null;
    }

    /** @return BelongsTo<PreparationWave, $this> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
