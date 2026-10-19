<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class EngineeringTaskAttachment extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'engineering_task_attachments';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'task_id',
        'company_id',
        'uploaded_by_id',
        'filename',
        'original_filename',
        'content_type',
        'size_bytes',
        'storage_disk',
        'storage_path',
        'checksum',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class, 'task_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'uploaded_by_id');
    }

    public function getDownloadUrlAttribute(): string
    {
        return url("storage/{$this->storage_path}");
    }
}
