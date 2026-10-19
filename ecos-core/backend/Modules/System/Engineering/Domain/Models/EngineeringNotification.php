<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EngineeringNotification extends Model
{
    use HasUuids;

    protected $table = 'engineering_notifications';

    protected $fillable = [
        'pipeline_id',
        'type',
        'title',
        'message',
        'severity',
        'is_read',
        'read_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'is_read'  => 'boolean',
            'read_at'  => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(EngineeringPipeline::class, 'pipeline_id');
    }
}
