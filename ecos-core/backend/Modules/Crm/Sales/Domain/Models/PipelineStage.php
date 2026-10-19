<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A stage in a pipeline, with a win probability. */
class PipelineStage extends Model
{
    use HasUuids;

    protected $table = 'crm_pipeline_stages';

    protected $fillable = ['pipeline_id', 'name', 'order', 'probability', 'is_won', 'is_lost'];

    protected function casts(): array
    {
        return ['order' => 'integer', 'probability' => 'integer', 'is_won' => 'boolean', 'is_lost' => 'boolean'];
    }

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(Pipeline::class, 'pipeline_id');
    }
}
