<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;
use Modules\Core\BusinessAttribution\Application\Actions\CalculateAttributionAction;
use Modules\Core\BusinessAttribution\Application\Services\AttributionService;
use Modules\Core\BusinessAttribution\Domain\Models\AttributionConfig;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;

class AttributionController extends Controller
{
    public function __construct(
        private readonly AttributionService $attributionService,
        private readonly CalculateAttributionAction $calculateAction,
    ) {}

    /**
     * Calculate attribution credit for a Business DNA record.
     * Supports optional model override; defaults to company default → last_touch.
     */
    public function calculate(Request $request, BusinessDna $businessDna): JsonResponse
    {
        $model = $request->query('model');
        $result = $this->calculateAction->execute($businessDna, $model);

        return response()->json(['data' => $result]);
    }

    /** List attribution configs for a company. */
    public function configs(Request $request): AnonymousResourceCollection
    {
        $request->validate(['company_id' => ['required', 'uuid']]);

        $configs = AttributionConfig::where('company_id', $request->query('company_id'))->get();

        return \Illuminate\Http\Resources\Json\JsonResource::collection($configs->map(static fn ($c) => [
            'id' => $c->id,
            'company_id' => $c->company_id,
            'model' => $c->model->value,
            'model_label' => $c->model->label(),
            'model_description' => $c->model->description(),
            'config' => $c->config,
            'is_default' => $c->is_default,
            'created_at' => $c->created_at?->toIso8601String(),
        ]));
    }

    /** Create or update a company attribution config. */
    public function saveConfig(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => ['required', 'uuid'],
            'model' => ['required', 'string'],
            'config' => ['nullable', 'array'],
            'is_default' => ['boolean'],
        ]);

        // If setting as default, clear other defaults for this company
        if (! empty($data['is_default'])) {
            AttributionConfig::where('company_id', $data['company_id'])
                ->update(['is_default' => false]);
        }

        $config = AttributionConfig::updateOrCreate(
            ['company_id' => $data['company_id'], 'model' => $data['model']],
            array_merge(['id' => Str::uuid()->toString()], $data),
        );

        return response()->json(['data' => [
            'id' => $config->id,
            'model' => $config->model->value,
            'is_default' => $config->is_default,
        ]], 201);
    }
}
