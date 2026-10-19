<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Str;
use Modules\System\Engineering\Domain\Enums\PipelineStage;
use Modules\System\Engineering\Domain\Enums\StageStatus;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;
use Modules\System\Engineering\Domain\Models\EngineeringPipelineLog;
use Modules\System\Engineering\Domain\Models\EngineeringPipelineTemplate;

/**
 * Creates pipeline stage logs from a template definition.
 * Falls back to the full 11-stage default when no template is specified.
 */
final class PipelineTemplateEngine
{
    public function resolveBySlug(string $slug): ?EngineeringPipelineTemplate
    {
        return EngineeringPipelineTemplate::where('slug', $slug)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Create stage log records from the template's stage config.
     * Returns the number of stages created.
     */
    public function createStageLogsFromTemplate(
        EngineeringPipeline $pipeline,
        EngineeringPipelineTemplate $template,
    ): int {
        $configs = $template->enabledStageConfigs();
        $count   = 0;

        foreach ($configs as $config) {
            EngineeringPipelineLog::create([
                'id'          => Str::uuid()->toString(),
                'pipeline_id' => $pipeline->id,
                'stage'       => $config->handler,
                'stage_label' => $config->label,
                'status'      => StageStatus::Pending->value,
                'sort_order'  => $config->order,
            ]);
            $count++;
        }

        return $count;
    }

    /**
     * Create the default 11-stage logs (backward-compatible fallback).
     */
    public function createDefaultStageLogs(EngineeringPipeline $pipeline): int
    {
        $count = 0;

        foreach (PipelineStage::orderedStages() as $idx => $stage) {
            EngineeringPipelineLog::create([
                'id'          => Str::uuid()->toString(),
                'pipeline_id' => $pipeline->id,
                'stage'       => $stage->value,
                'stage_label' => $stage->label(),
                'status'      => StageStatus::Pending->value,
                'sort_order'  => $idx + 1,
            ]);
            $count++;
        }

        return $count;
    }

    /**
     * Resolve a template and create logs, or fall back to defaults.
     * Returns [template|null, stagesCreated].
     */
    public function initializePipeline(
        EngineeringPipeline $pipeline,
        ?string $templateSlug = null,
    ): array {
        if ($templateSlug !== null) {
            $template = $this->resolveBySlug($templateSlug);

            if ($template !== null) {
                $count = $this->createStageLogsFromTemplate($pipeline, $template);
                return [$template, $count];
            }
        }

        $count = $this->createDefaultStageLogs($pipeline);
        return [null, $count];
    }
}
