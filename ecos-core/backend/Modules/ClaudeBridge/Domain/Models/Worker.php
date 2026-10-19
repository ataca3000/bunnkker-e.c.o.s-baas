<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\ClaudeBridge\Domain\Enums\WorkerStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property string $hostname
 * @property string $token_hash
 * @property WorkerStatus $status
 * @property \Carbon\Carbon|null $last_seen_at
 * @property string|null $claude_version
 * @property \Carbon\Carbon $registered_at
 * @property string $registered_by
 * @property bool $is_active
 */
final class Worker extends Model
{
    use HasUuids;

    protected $table = 'cb_workers';

    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'name',
        'hostname',
        'token_hash',
        'status',
        'last_seen_at',
        'claude_version',
        'registered_at',
        'registered_by',
        'is_active',
    ];

    protected $casts = [
        'status' => WorkerStatus::class,
        'last_seen_at' => 'datetime',
        'registered_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    protected $hidden = ['token_hash'];

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'worker_id');
    }

    public function executions(): HasMany
    {
        return $this->hasMany(Execution::class, 'worker_id');
    }

    public function isOnline(): bool
    {
        return $this->status === WorkerStatus::Online && $this->is_active;
    }
}
