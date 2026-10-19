<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class EngineeringChecklistItem extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'engineering_checklist_items';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'checklist_id',
        'company_id',
        'content',
        'is_completed',
        'completed_by_id',
        'completed_at',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'is_completed' => 'boolean',
            'completed_at' => 'datetime',
            'position'     => 'integer',
        ];
    }

    public function checklist(): BelongsTo
    {
        return $this->belongsTo(EngineeringTaskChecklist::class, 'checklist_id');
    }
}
