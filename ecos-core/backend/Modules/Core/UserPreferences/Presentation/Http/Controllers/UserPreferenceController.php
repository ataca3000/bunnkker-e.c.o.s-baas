<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\UserPreferences\Application\DTO\PreferenceDTO;
use Modules\Core\UserPreferences\Application\Services\UserPreferenceService;
use Modules\Core\UserPreferences\Presentation\Http\Requests\UpsertCategoryPreferencesRequest;
use Modules\Core\UserPreferences\Presentation\Http\Resources\UserPreferenceResource;

/**
 * User-scoped preference endpoints.
 *
 * All routes are under /me/preferences and require auth:sanctum.
 * The authenticated user is the implicit subject — no user_id in the URL.
 *
 * Routes (registered in api.php):
 *   GET    /me/preferences              index()
 *   GET    /me/preferences/{category}   show()
 *   PUT    /me/preferences/{category}   upsert()
 *   DELETE /me/preferences/{category}   resetCategory()
 *   DELETE /me/preferences              resetAll()
 */
final class UserPreferenceController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly UserPreferenceService $service,
    ) {}

    /**
     * GET /me/preferences
     *
     * Returns all categories as a flat map: { "products": {...}, "theme": {...} }
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $all = $this->service->getAll((int) $user->id);

        // Return a flat category → payload map for ergonomic frontend consumption.
        $data = $all->map(fn ($pref) => $pref->payload)->all();

        return $this->success($data);
    }

    /**
     * GET /me/preferences/{category}
     *
     * Returns the payload for one category, or 404 if never set.
     */
    public function show(Request $request, string $category): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $preference = $this->service->getByCategory((int) $user->id, $category);

        if ($preference === null) {
            return $this->error("No preferences found for category '{$category}'.", 404);
        }

        return $this->success(new UserPreferenceResource($preference));
    }

    /**
     * PUT /me/preferences/{category}
     *
     * Full replacement of the category payload. Not a merge/patch.
     * Returns the saved preference record.
     */
    public function upsert(
        UpsertCategoryPreferencesRequest $request,
        string $category,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $dto = PreferenceDTO::fromArray([
            'category' => $category,
            'payload' => $request->validated('payload'),
        ]);

        $preference = $this->service->upsert((int) $user->id, $dto->category, $dto->payload);

        return $this->success(new UserPreferenceResource($preference), 'Preferences saved.');
    }

    /**
     * DELETE /me/preferences/{category}
     *
     * Removes the preference record for one category.
     * The frontend falls back to its hard-coded defaults.
     */
    public function resetCategory(Request $request, string $category): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $this->service->resetCategory((int) $user->id, $category);

        return $this->deleted("Preferences for category '{$category}' reset.");
    }

    /**
     * DELETE /me/preferences
     *
     * Removes ALL preference records for the authenticated user.
     */
    public function resetAll(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $count = $this->service->resetAll((int) $user->id);

        return $this->deleted("All preferences reset ({$count} categories removed).");
    }
}
