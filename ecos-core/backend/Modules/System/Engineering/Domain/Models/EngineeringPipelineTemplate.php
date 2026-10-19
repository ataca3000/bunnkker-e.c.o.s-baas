<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\System\Engineering\Domain\ValueObjects\StageConfig;

/**
 * @property string       $id
 * @property string       $name
 * @property string       $slug
 * @property string|null  $description
 * @property int          $version
 * @property bool         $is_active
 * @property bool         $is_system
 * @property array        $stages       Raw JSON — use stageConfigs() for typed access
 * @property array|null   $metadata
 */
class EngineeringPipelineTemplate extends Model
{
    use HasUuids;

    protected $table = 'engineering_pipeline_templates';

    protected $fillable = [
        'id', 'name', 'slug', 'description', 'version',
        'is_active', 'is_system', 'stages', 'metadata',
    ];

    protected $casts = [
        'version'   => 'integer',
        'is_active' => 'boolean',
        'is_system' => 'boolean',
        'stages'    => 'array',
        'metadata'  => 'array',
    ];

    /** @return list<StageConfig> */
    public function stageConfigs(): array
    {
        return array_map(
            fn (array $raw) => StageConfig::fromArray($raw),
            $this->stages ?? [],
        );
    }

    /** Return only the enabled stages, sorted by order. */
    public function enabledStageConfigs(): array
    {
        $configs = array_filter($this->stageConfigs(), fn (StageConfig $s) => $s->enabled);
        usort($configs, fn (StageConfig $a, StageConfig $b) => $a->order <=> $b->order);
        return array_values($configs);
    }
}
