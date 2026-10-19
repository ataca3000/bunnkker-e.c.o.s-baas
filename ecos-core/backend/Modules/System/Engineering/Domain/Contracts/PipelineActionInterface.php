<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Contracts;

use Modules\System\Engineering\Domain\Models\EngineeringPipeline;
use Modules\System\Engineering\Domain\Models\EngineeringPipelineLog;

/**
 * A discrete, composable unit of work that belongs to a pipeline stage.
 *
 * Actions are the leaf-level executors (commit, push, tag, notify, archive).
 * Stages orchestrate one or more actions in sequence.
 */
interface PipelineActionInterface
{
    public function name(): string;

    /**
     * @param  array<string, mixed> $context  Stage-level shared context (commit SHA, etc.)
     * @return array<string, mixed>           Merged additions to $context
     */
    public function execute(
        EngineeringPipeline    $pipeline,
        EngineeringPipelineLog $log,
        array                  $context = [],
    ): array;
}
