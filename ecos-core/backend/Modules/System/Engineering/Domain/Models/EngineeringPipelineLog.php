<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\StageStatus;
use Modules\System\Engineering\Domain\Enums\PipelineStage;

class EngineeringPipelineLog extends Model
{
    use HasUuids;

    protected $table = 'engineering_pipeline_logs';

    protected $fillable = [
        'pipeline_id',
        'stage',
        'stage_label',
        'sort_order',
        'status',
        'started_at',
        'finished_at',
        'duration_seconds',
        'message',
        'payload',
        'retry_count',
    ];

    protected function casts(): array
    {
        return [
            'started_at'  => 'datetime',
            'finished_at' => 'datetime',
            'payload'     => 'array',
            'retry_count' => 'integer',
            'sort_order'  => 'integer',
        ];
    }

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(EngineeringPipeline::class, 'pipeline_id');
    }

    public function getStatusEnum(): StageStatus
    {
        return StageStatus::from($this->status);
    }

    public function getStageEnum(): ?PipelineStage
    {
        return PipelineStage::tryFrom($this->stage);
    }
}
