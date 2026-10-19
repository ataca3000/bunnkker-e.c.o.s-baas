<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Brands\Domain\Models\BrandDeliveryTimeSlot;
use Modules\Organization\Brands\Presentation\Http\Resources\BrandDeliveryTimeSlotResource;

/**
 * Brand Delivery Time Slots — customer-facing checkout time windows.
 *
 * GET    /brands/{brand}/delivery-time-slots
 * POST   /brands/{brand}/delivery-time-slots
 * PUT    /brands/{brand}/delivery-time-slots/{slot}
 * DELETE /brands/{brand}/delivery-time-slots/{slot}
 * POST   /brands/{brand}/delivery-time-slots/seed-defaults
 * PATCH  /brands/{brand}/delivery-time-slots/reorder
 */
final class BrandDeliveryTimeSlotController extends Controller
{
    use HasApiResponse;

    public function index(string $brandId): AnonymousResourceCollection
    {
        Brand::findOrFail($brandId);

        $slots = BrandDeliveryTimeSlot::where('brand_id', $brandId)
            ->orderBy('display_order')
            ->orderBy('start_time')
            ->get();

        return BrandDeliveryTimeSlotResource::collection($slots);
    }

    public function store(Request $request, string $brandId): JsonResponse
    {
        Brand::findOrFail($brandId);

        $data = $request->validate([
            'name' => 'required|string|max:100',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
            'display_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $data['start_time'] .= ':00';
        $data['end_time'] .= ':00';

        $nextOrder = BrandDeliveryTimeSlot::where('brand_id', $brandId)->max('display_order') ?? 0;

        $slot = BrandDeliveryTimeSlot::create([
            ...$data,
            'brand_id' => $brandId,
            'display_order' => $data['display_order'] ?? ($nextOrder + 1),
            'is_active' => $data['is_active'] ?? true,
        ]);

        return $this->created(new BrandDeliveryTimeSlotResource($slot), 'Delivery time slot created.');
    }

    public function update(Request $request, string $brandId, string $slotId): JsonResponse
    {
        $slot = BrandDeliveryTimeSlot::where('brand_id', $brandId)->findOrFail($slotId);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'start_time' => 'sometimes|required|date_format:H:i',
            'end_time' => 'sometimes|required|date_format:H:i',
            'display_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        if (isset($data['start_time'])) {
            $data['start_time'] .= ':00';
        }
        if (isset($data['end_time'])) {
            $data['end_time'] .= ':00';
        }

        $slot->update($data);

        return $this->updated(new BrandDeliveryTimeSlotResource($slot->fresh()), 'Delivery time slot updated.');
    }

    public function destroy(string $brandId, string $slotId): JsonResponse
    {
        $slot = BrandDeliveryTimeSlot::where('brand_id', $brandId)->findOrFail($slotId);
        $slot->delete();

        return $this->deleted('Delivery time slot deleted.');
    }

    /** Seed the four default time slots. Blocked if slots already exist. */
    public function seedDefaults(string $brandId): JsonResponse
    {
        Brand::findOrFail($brandId);

        $existing = BrandDeliveryTimeSlot::where('brand_id', $brandId)->count();
        abort_if($existing > 0, 422, 'Brand already has delivery time slots configured.');

        $created = collect(BrandDeliveryTimeSlot::defaults())->map(
            fn (array $defaults) => BrandDeliveryTimeSlot::create([
                ...$defaults,
                'brand_id' => $brandId,
                'is_active' => true,
            ]),
        );

        return $this->created(BrandDeliveryTimeSlotResource::collection($created), 'Default time slots seeded.');
    }

    /** Reorder slots by providing an ordered array of IDs. */
    public function reorder(Request $request, string $brandId): AnonymousResourceCollection
    {
        Brand::findOrFail($brandId);

        $data = $request->validate([
            'ordered_ids' => 'required|array',
            'ordered_ids.*' => 'uuid',
        ]);

        foreach ($data['ordered_ids'] as $index => $slotId) {
            BrandDeliveryTimeSlot::where('brand_id', $brandId)
                ->where('id', $slotId)
                ->update(['display_order' => $index]);
        }

        return BrandDeliveryTimeSlotResource::collection(
            BrandDeliveryTimeSlot::where('brand_id', $brandId)
                ->orderBy('display_order')
                ->get(),
        );
    }
}
