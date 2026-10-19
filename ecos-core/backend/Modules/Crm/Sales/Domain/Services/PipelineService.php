<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Sales\Domain\Models\Pipeline;
use Modules\Crm\Sales\Domain\Models\PipelineStage;

/** Manages sales pipelines and their ordered stages. */
final class PipelineService
{
    /**
     * @param  list<array{name:string, probability?:int, is_won?:bool, is_lost?:bool}>  $stages
     */
    public function create(string $companyId, string $name, array $stages, bool $default = false): Pipeline
    {
        return DB::transaction(function () use ($companyId, $name, $stages, $default): Pipeline {
            if ($default) {
                Pipeline::query()->where('company_id', $companyId)->update(['is_default' => false]);
            }

            $pipeline = Pipeline::create(['company_id' => $companyId, 'name' => $name, 'is_default' => $default]);

            $order = 0;
            foreach ($stages as $stage) {
                PipelineStage::create([
                    'pipeline_id' => $pipeline->id,
                    'name' => $stage['name'],
                    'order' => $order++,
                    'probability' => $stage['probability'] ?? 0,
                    'is_won' => $stage['is_won'] ?? false,
                    'is_lost' => $stage['is_lost'] ?? false,
                ]);
            }

            return $pipeline->refresh();
        });
    }

    public function defaultPipeline(string $companyId): ?Pipeline
    {
        return Pipeline::query()->where('company_id', $companyId)->where('is_default', true)->with('stages')->first()
            ?? Pipeline::query()->where('company_id', $companyId)->with('stages')->orderBy('id')->first();
    }

    public function firstStage(Pipeline $pipeline): ?PipelineStage
    {
        return $pipeline->stages()->orderBy('order')->first();
    }
}
