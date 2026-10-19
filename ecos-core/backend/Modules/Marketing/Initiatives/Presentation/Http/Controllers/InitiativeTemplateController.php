<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Marketing\Initiatives\Application\Actions\CreateInitiativeFromTemplateAction;
use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiativeTemplate;
use Modules\Marketing\Initiatives\Presentation\Http\Resources\InitiativeResource;
use Modules\Marketing\Initiatives\Presentation\Http\Resources\InitiativeTemplateResource;

final class InitiativeTemplateController extends Controller
{
    public function __construct(
        private readonly CreateInitiativeFromTemplateAction $createFromTemplate,
    ) {}

    /** GET /marketing/initiative-templates */
    public function index(Request $request): AnonymousResourceCollection
    {
        $templates = MarketingInitiativeTemplate::query()
            ->when($request->query('category'), fn ($q, $v) => $q->where('category', $v))
            ->when($request->boolean('system_only'), fn ($q) => $q->where('is_system', true))
            ->orderByDesc('is_system')
            ->orderBy('name')
            ->get();

        return InitiativeTemplateResource::collection($templates);
    }

    /** GET /marketing/initiative-templates/{template} */
    public function show(MarketingInitiativeTemplate $initiativeTemplate): InitiativeTemplateResource
    {
        return new InitiativeTemplateResource($initiativeTemplate);
    }

    /** POST /marketing/initiative-templates */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:100', 'unique:marketing_initiative_templates,slug'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:100'],
            'defaults' => ['nullable', 'array'],
        ]);

        $template = MarketingInitiativeTemplate::create([
            ...$validated,
            'is_system' => false,
            'usage_count' => 0,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json(new InitiativeTemplateResource($template), 201);
    }

    /** PUT /marketing/initiative-templates/{template} */
    public function update(Request $request, MarketingInitiativeTemplate $initiativeTemplate): JsonResponse
    {
        if ($initiativeTemplate->is_system) {
            return response()->json(['message' => 'System templates cannot be modified.'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:100'],
            'defaults' => ['nullable', 'array'],
        ]);

        $initiativeTemplate->update($validated);

        return response()->json(new InitiativeTemplateResource($initiativeTemplate->fresh() ?? $initiativeTemplate));
    }

    /** DELETE /marketing/initiative-templates/{template} */
    public function destroy(MarketingInitiativeTemplate $initiativeTemplate): JsonResponse
    {
        if ($initiativeTemplate->is_system) {
            return response()->json(['message' => 'System templates cannot be deleted.'], 403);
        }

        $initiativeTemplate->delete();

        return response()->json(['message' => 'Template deleted.']);
    }

    /** POST /marketing/initiative-templates/{template}/create-initiative */
    public function createInitiative(Request $request, MarketingInitiativeTemplate $initiativeTemplate): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'company_id' => ['nullable', 'string'],
            'brand_id' => ['nullable', 'string'],
            'channel_id' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'business_goal' => ['nullable', 'string'],
            'season' => ['nullable', 'string'],
        ]);

        $initiative = $this->createFromTemplate->execute(
            template: $initiativeTemplate,
            overrides: $validated,
            actorId: $request->user()?->id,
        );

        return response()->json(new InitiativeResource($initiative), 201);
    }
}
