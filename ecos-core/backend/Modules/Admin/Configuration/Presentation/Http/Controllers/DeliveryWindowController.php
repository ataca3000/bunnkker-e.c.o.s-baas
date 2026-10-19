<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Admin\Configuration\Domain\Models\DeliveryWindow;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;

/**
 * Manages brand delivery windows (time slots).
 * Consumed by Orders, Preparation OS, Logistics, and Driver App.
 *
 * GET    /configuration/brands/{brandId}/delivery-windows
 * POST   /configuration/brands/{brandId}/delivery-windows
 * PUT    /configuration/brands/{brandId}/delivery-windows/{id}
 * DELETE /configuration/brands/{brandId}/delivery-windows/{id}
 * POST   /configuration/brands/{brandId}/delivery-windows/seed-defaults
 * PATCH  /configuration/brands/{brandId}/delivery-windows/reorder
 */
final class DeliveryWindowController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly ConfigAuditService $audit) {}

    public function index(string $brandId): JsonResponse
    {
        $windows = DeliveryWindow::where('brand_id', $brandId)
            ->orderBy('sort_order')
            ->get();

        return $this->success($windows);
    }

    public function store(Request $request, string $brandId): JsonResponse
    {
        $validated = $request->validate([
            'label' => 'required|string|max:100',
            'starts_at' => 'required|date_format:H:i',
            'ends_at' => 'required|date_format:H:i',
            'sort_order' => 'nullable|integer|min:0',
            'is_enabled' => 'nullable|boolean',
        ]);

        $companyId = Auth::user()?->company_id ?? '';
        $actorId = Auth::id() ?? '';

        // Normalize to H:i:s
        $validated['starts_at'] .= ':00';
        $validated['ends_at'] .= ':00';

        $window = DeliveryWindow::create([
            ...$validated,
            'brand_id' => $brandId,
            'company_id' => $companyId,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        $this->audit->record(
            companyId: $companyId,
            module: 'delivery_window',
            category: 'delivery_window',
            action: 'create',
            oldValue: null,
            newValue: $window->toArray(),
            brandId: $brandId,
        );

        return $this->created($window, 'Delivery window created.');
    }

    public function update(Request $request, string $brandId, string $id): JsonResponse
    {
        $window = DeliveryWindow::where('brand_id', $brandId)->findOrFail($id);

        $validated = $request->validate([
            'label' => 'sometimes|required|string|max:100',
            'starts_at' => 'sometimes|required|date_format:H:i',
            'ends_at' => 'sometimes|required|date_format:H:i',
            'sort_order' => 'nullable|integer|min:0',
            'is_enabled' => 'nullable|boolean',
        ]);

        if (isset($validated['starts_at'])) {
            $validated['starts_at'] .= ':00';
        }
        if (isset($validated['ends_at'])) {
            $validated['ends_at'] .= ':00';
        }

        $old = $window->toArray();
        $window->update([...$validated, 'updated_by' => Auth::id()]);

        $this->audit->record(
            companyId: Auth::user()?->company_id ?? '',
            module: 'delivery_window',
            category: 'delivery_window',
            action: 'update',
            oldValue: $old,
            newValue: $window->fresh()?->toArray() ?? [],
            brandId: $brandId,
        );

        return $this->updated($window, 'Delivery window updated.');
    }

    public function destroy(string $brandId, string $id): JsonResponse
    {
        $window = DeliveryWindow::where('brand_id', $brandId)->findOrFail($id);

        $this->audit->record(
            companyId: Auth::user()?->company_id ?? '',
            module: 'delivery_window',
            category: 'delivery_window',
            action: 'delete',
            oldValue: $window->toArray(),
            newValue: null,
            brandId: $brandId,
        );

        $window->delete();

        return $this->deleted('Delivery window deleted.');
    }

    /** Seed the four default delivery windows for a brand. */
    public function seedDefaults(string $brandId): JsonResponse
    {
        $companyId = Auth::user()?->company_id ?? '';
        $actorId = Auth::id() ?? '';

        $existing = DeliveryWindow::where('brand_id', $brandId)->count();
        abort_if($existing > 0, 422, 'Brand already has delivery windows configured.');

        $created = collect(DeliveryWindow::defaults())->map(function (array $defaults) use ($brandId, $companyId, $actorId): DeliveryWindow {
            return DeliveryWindow::create([
                ...$defaults,
                'brand_id' => $brandId,
                'company_id' => $companyId,
                'is_enabled' => true,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
        });

        return $this->created($created, 'Default delivery windows created.');
    }

    /** Reorder windows by providing ordered list of IDs. */
    public function reorder(Request $request, string $brandId): JsonResponse
    {
        $validated = $request->validate([
            'ordered_ids' => 'required|array',
            'ordered_ids.*' => 'uuid',
        ]);

        foreach ($validated['ordered_ids'] as $index => $windowId) {
            DeliveryWindow::where('brand_id', $brandId)
                ->where('id', $windowId)
                ->update(['sort_order' => $index]);
        }

        return $this->success(
            DeliveryWindow::where('brand_id', $brandId)->orderBy('sort_order')->get(),
            'Windows reordered.',
        );
    }
}
