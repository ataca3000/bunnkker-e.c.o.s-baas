<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EngineeringExecutionArtifact extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'engineering_execution_artifacts';

    protected $fillable = [
        'session_id',
        'company_id',
        'artifact_type',
        'filename',
        'content_type',
        'size_bytes',
        'storage_disk',
        'storage_path',
        'checksum',
        'metadata',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'metadata'   => 'array',
    ];

    protected $appends = [
        'download_url',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ExecutionSession::class, 'session_id');
    }

    public function getDownloadUrlAttribute(): string
    {
        return url("storage/{$this->storage_path}");
    }
}
