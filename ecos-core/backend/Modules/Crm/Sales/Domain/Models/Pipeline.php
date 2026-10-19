<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A sales pipeline — an ordered set of stages. */
class Pipeline extends Model
{
    use HasUuids;

    protected $table = 'crm_pipelines';

    protected $fillable = ['company_id', 'name', 'is_default'];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    public function stages(): HasMany
    {
        return $this->hasMany(PipelineStage::class, 'pipeline_id')->orderBy('order');
    }
}
