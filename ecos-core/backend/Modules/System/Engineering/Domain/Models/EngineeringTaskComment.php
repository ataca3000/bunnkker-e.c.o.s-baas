<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class EngineeringTaskComment extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'engineering_task_comments';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'task_id',
        'company_id',
        'author_id',
        'body',
        'is_system',
        'is_internal',
    ];

    protected function casts(): array
    {
        return [
            'is_system'   => 'boolean',
            'is_internal' => 'boolean',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class, 'task_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'author_id');
    }
}
