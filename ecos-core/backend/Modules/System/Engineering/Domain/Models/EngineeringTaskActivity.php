<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class EngineeringTaskActivity extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'engineering_task_activity';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'task_id',
        'company_id',
        'activity_type',
        'causer_id',
        'causer_type',
        'properties',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'properties' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class, 'task_id');
    }
}
