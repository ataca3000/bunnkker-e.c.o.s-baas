<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\ClaudeBridge\Domain\Enums\ArtifactType;

/**
 * @property string $id
 * @property string $task_id
 * @property string $execution_id
 * @property ArtifactType $type
 * @property string $filename
 * @property string $storage_path
 * @property int $size_bytes
 * @property string $checksum_sha256
 * @property \Carbon\Carbon $created_at
 */
final class Artifact extends Model
{
    use HasUuids;

    protected $table = 'cb_artifacts';

    public $timestamps = false;

    const CREATED_AT = 'created_at';

    protected $fillable = [
        'task_id',
        'execution_id',
        'type',
        'filename',
        'storage_path',
        'size_bytes',
        'checksum_sha256',
        'created_at',
    ];

    protected $casts = [
        'type' => ArtifactType::class,
        'created_at' => 'datetime',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function execution(): BelongsTo
    {
        return $this->belongsTo(Execution::class, 'execution_id');
    }
}
