<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class EngineeringTaskChecklist extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'engineering_task_checklists';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'task_id',
        'company_id',
        'title',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(EngineeringTask::class, 'task_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(EngineeringChecklistItem::class, 'checklist_id')
            ->orderBy('position', 'asc');
    }

    public function getProgressAttribute(): array
    {
        $items     = $this->items()->get();
        $total     = $items->count();
        $completed = $items->where('is_completed', true)->count();
        $percent   = $total > 0 ? (int) round(($completed / $total) * 100) : 0;

        return [
            'total'     => $total,
            'completed' => $completed,
            'percent'   => $percent,
        ];
    }
}
