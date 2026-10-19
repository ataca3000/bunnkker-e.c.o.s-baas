<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\System\Engineering\Domain\Models\EngineeringPipelineTemplate;

final class PipelineTemplateController extends Controller
{
    use HasApiResponse;

    /** GET /api/system/engineering/templates */
    public function index(): JsonResponse
    {
        $templates = EngineeringPipelineTemplate::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description', 'version', 'is_system', 'metadata', 'stages'])
            ->map(fn (EngineeringPipelineTemplate $t) => [
                'id'          => $t->id,
                'name'        => $t->name,
                'slug'        => $t->slug,
                'description' => $t->description,
                'version'     => $t->version,
                'is_system'   => $t->is_system,
                'metadata'    => $t->metadata,
                'stage_count' => count(array_filter($t->stages ?? [], fn ($s) => $s['enabled'] ?? true)),
            ]);

        return $this->success($templates);
    }

    /** GET /api/system/engineering/templates/{slug} */
    public function show(string $slug): JsonResponse
    {
        $template = EngineeringPipelineTemplate::where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if ($template === null) {
            return $this->error('Template not found.', 404);
        }

        return $this->success([
            'id'          => $template->id,
            'name'        => $template->name,
            'slug'        => $template->slug,
            'description' => $template->description,
            'version'     => $template->version,
            'is_system'   => $template->is_system,
            'metadata'    => $template->metadata,
            'stages'      => $template->stages,
        ]);
    }
}
