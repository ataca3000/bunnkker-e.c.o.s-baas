<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\System\Engineering\Domain\Enums\PipelineStatus;
use Modules\System\Engineering\Domain\Enums\PipelineStage;

class EngineeringPipeline extends Model
{
    use HasUuids;

    protected $table = 'engineering_pipelines';

    protected $fillable = [
        'task_name',
        'branch',
        'commit_sha',
        'status',
        'current_stage',
        'started_at',
        'finished_at',
        'duration_seconds',
        'initiated_by',
        'initiated_by_user_id',
        'error_message',
        'auto_deploy',
        'metadata',
        'template_id',
        'template_slug',
    ];

    protected function casts(): array
    {
        return [
            'started_at'  => 'datetime',
            'finished_at' => 'datetime',
            'auto_deploy' => 'boolean',
            'metadata'    => 'array',
        ];
    }

    public function logs(): HasMany
    {
        return $this->hasMany(EngineeringPipelineLog::class, 'pipeline_id')
            ->orderBy('sort_order')
            ->orderBy('created_at');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(EngineeringNotification::class, 'pipeline_id');
    }

    public function getStatusEnum(): PipelineStatus
    {
        return PipelineStatus::from($this->status);
    }

    public function getCurrentStageEnum(): ?PipelineStage
    {
        return $this->current_stage ? PipelineStage::from($this->current_stage) : null;
    }

    public function isRunning(): bool
    {
        return $this->status === PipelineStatus::Running->value;
    }

    public function isTerminal(): bool
    {
        return $this->getStatusEnum()->isTerminal();
    }

    public function durationFormatted(): string
    {
        if ($this->duration_seconds === null) {
            return '—';
        }

        $minutes = (int) floor($this->duration_seconds / 60);
        $seconds = $this->duration_seconds % 60;

        return $minutes > 0 ? "{$minutes}m {$seconds}s" : "{$seconds}s";
    }
}
