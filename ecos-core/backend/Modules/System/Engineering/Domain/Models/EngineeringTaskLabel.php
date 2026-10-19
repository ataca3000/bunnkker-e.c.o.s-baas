<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

final class EngineeringTaskLabel extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'engineering_task_labels';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'name',
        'color',
        'description',
        'created_by_id',
    ];

    protected function casts(): array
    {
        return [];
    }

    public function tasks(): BelongsToMany
    {
        return $this->belongsToMany(EngineeringTask::class, 'engineering_task_label_pivot');
    }
}
