<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class EngineeringTaskDependency extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'engineering_task_dependencies';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'task_id',
        'depends_on_task_id',
        'dependency_type',
        'created_by_id',
    ];

    protected function casts(): array
    {
        return [];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class, 'task_id');
    }

    public function dependsOnTask(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class, 'depends_on_task_id');
    }
}
