<?php

declare(strict_types=1);

namespace Modules\Marketing\MappingEngine\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Assets\Application\Actions\MapAssetAction;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\MappingEngine\Application\Services\MappingSuggestionService;
use Modules\Marketing\MappingEngine\Domain\Models\MappingProfile;

final class MappingProfileController extends Controller
{
    public function __construct(
        private readonly MappingSuggestionService $suggestions,
        private readonly MapAssetAction $mapAsset,
    ) {}

    /**
     * GET /marketing/mapping-profiles
     */
    public function index(Request $request): JsonResponse
    {
        $profiles = MappingProfile::query()
            ->when($request->has('company_id'), fn ($q) => $q->where('company_id', $request->string('company_id')))
            ->when($request->has('connector_type'), fn ($q) => $q->where('connector_type', $request->string('connector_type')))
            ->with('rules')
            ->orderByDesc('created_at')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'data' => $profiles->items(),
            'meta' => [
                'page' => $profiles->currentPage(),
                'per_page' => $profiles->perPage(),
                'total' => $profiles->total(),
                'last_page' => $profiles->lastPage(),
            ],
        ]);
    }

    /**
     * POST /marketing/mapping-profiles
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => ['nullable', 'string'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'connector_type' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'auto_apply' => ['boolean'],
            'rules' => ['sometimes', 'array'],
            'rules.*.match_field' => ['required_with:rules', 'string', 'in:name,name_contains,external_id,asset_type'],
            'rules.*.match_value' => ['required_with:rules', 'string'],
            'rules.*.related_type' => ['required_with:rules', 'string'],
            'rules.*.related_id' => ['required_with:rules', 'string'],
            'rules.*.priority' => ['nullable', 'integer'],
        ]);

        $profile = MappingProfile::create([
            'company_id' => $data['company_id'] ?? null,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'connector_type' => $data['connector_type'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'auto_apply' => $data['auto_apply'] ?? false,
            'created_by' => (string) (string) $request->user()->id,
        ]);

        foreach ($data['rules'] ?? [] as $i => $rule) {
            $profile->rules()->create([
                'match_field' => $rule['match_field'],
                'match_value' => $rule['match_value'],
                'related_type' => $rule['related_type'],
                'related_id' => $rule['related_id'],
                'priority' => $rule['priority'] ?? ($i + 1),
            ]);
        }

        $profile->load('rules');

        return response()->json(['data' => $profile], 201);
    }

    /**
     * GET /marketing/mapping-profiles/{profile}
     */
    public function show(MappingProfile $mappingProfile): JsonResponse
    {
        $mappingProfile->load('rules');

        return response()->json(['data' => $mappingProfile]);
    }

    /**
     * PUT /marketing/mapping-profiles/{profile}
     */
    public function update(Request $request, MappingProfile $mappingProfile): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'connector_type' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'auto_apply' => ['boolean'],
        ]);

        $mappingProfile->update($data);

        return response()->json(['data' => $mappingProfile->fresh()->load('rules')]);
    }

    /**
     * DELETE /marketing/mapping-profiles/{profile}
     */
    public function destroy(MappingProfile $mappingProfile): JsonResponse
    {
        $mappingProfile->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /marketing/mapping-profiles/{profile}/apply
     *
     * Re-run suggestions for all assets matching this profile.
     */
    public function apply(Request $request, MappingProfile $mappingProfile): JsonResponse
    {
        $companyId = $mappingProfile->company_id ?? $request->string('company_id')->toString();

        MarketingAsset::where('company_id', $companyId)->each(function (MarketingAsset $asset) use ($companyId): void {
            $this->suggestions->suggestForAsset($asset, $companyId);
        });

        return response()->json(['message' => 'Profile applied to all assets.']);
    }
}
