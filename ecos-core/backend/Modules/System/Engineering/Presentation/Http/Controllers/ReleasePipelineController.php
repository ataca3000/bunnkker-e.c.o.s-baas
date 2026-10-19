<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\ReleasePipelineAdapter;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleasePipelineRun;
use Modules\System\Traits\HasApiResponse;
final class ReleasePipelineController
{
    use HasApiResponse;
    public function __construct(private readonly ReleasePipelineAdapter $adapter) {}

    public function build(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $package = $this->adapter->buildPackage($release);
        return $this->success(['package' => $package]);
    }

    public function trigger(Request $request, EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $data = $request->validate(['trigger_type' => 'nullable|string|in:manual,scheduled,api']);
        $run  = $this->adapter->triggerPipeline($release, auth()->id(), $data['trigger_type'] ?? 'manual');
        return $this->success(['run' => $run], 201);
    }

    public function captureResult(Request $request, EngineeringRelease $release, EngineeringReleasePipelineRun $run): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        abort_if($run->release_id !== $release->id, 404);
        $data = $request->validate([
            'status'    => 'required|string|in:success,failed,cancelled',
            'logs'      => 'nullable|string',
            'result'    => 'nullable|array',
            'exit_code' => 'nullable|integer',
        ]);
        $this->adapter->capturePipelineResult($run, $data['status'], $data['logs'] ?? null, $data['result'] ?? null, $data['exit_code'] ?? null);
        return $this->success(['message' => 'Pipeline result captured']);
    }

    public function history(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        return $this->success(['runs' => $this->adapter->getPipelineHistory($release)]);
    }
}
