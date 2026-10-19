<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\PipelineRecoveryService;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;
use Modules\System\Engineering\Infrastructure\Jobs\ExecutePipelineJob;
use Modules\System\Engineering\Presentation\Http\Resources\PipelineResource;

final class PipelineRecoveryController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly PipelineRecoveryService $recovery,
    ) {}

    /** POST /api/system/engineering/pipelines/{id}/resume */
    public function resume(string $id): JsonResponse
    {
        $ok = $this->recovery->resume($id);

        if (! $ok) {
            return $this->error('Pipeline cannot be resumed (must be in failed state).', 422);
        }

        return $this->success(
            new PipelineResource(EngineeringPipeline::with('logs')->find($id)),
            'Pipeline resumed from failed stage.',
        );
    }

    /** POST /api/system/engineering/pipelines/{id}/restart */
    public function restart(string $id): JsonResponse
    {
        $ok = $this->recovery->restartPipeline($id);

        if (! $ok) {
            return $this->error('Pipeline cannot be restarted from scratch.', 422);
        }

        return $this->success(
            new PipelineResource(EngineeringPipeline::with('logs')->find($id)),
            'Pipeline restarted from the beginning.',
        );
    }

    /** POST /api/system/engineering/pipelines/{id}/restart-stage */
    public function restartStage(string $id, Request $request): JsonResponse
    {
        $request->validate(['stage' => 'required|string']);

        $ok = $this->recovery->restartStage($id, $request->string('stage')->toString());

        if (! $ok) {
            return $this->error('Stage cannot be restarted. Pipeline must be in failed or cancelled state and stage must exist.', 422);
        }

        return $this->success(
            new PipelineResource(EngineeringPipeline::with('logs')->find($id)),
            'Pipeline restarted from specified stage.',
        );
    }

    /** POST /api/system/engineering/pipelines/{id}/skip-stage */
    public function skipStage(string $id, Request $request): JsonResponse
    {
        $request->validate(['stage' => 'required|string']);

        $ok = $this->recovery->skipStage($id, $request->string('stage')->toString());

        if (! $ok) {
            return $this->error('Stage cannot be skipped. Pipeline must be in failed, cancelled, or running state.', 422);
        }

        return $this->success(
            new PipelineResource(EngineeringPipeline::with('logs')->find($id)),
            'Stage marked as skipped.',
        );
    }
}
