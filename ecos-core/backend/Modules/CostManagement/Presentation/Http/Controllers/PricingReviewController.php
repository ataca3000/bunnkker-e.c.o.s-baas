<?php

declare(strict_types=1);

namespace Modules\CostManagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\CostManagement\Domain\Enums\PricingReviewStatus;
use Modules\CostManagement\Domain\Models\PricingReview;
use Modules\CostManagement\Domain\Services\PricingReviewService;
use Modules\CostManagement\Presentation\Http\Requests\ApprovePricingReviewRequest;
use Modules\CostManagement\Presentation\Http\Resources\PricingReviewResource;

class PricingReviewController extends Controller
{
    public function __construct(
        private readonly PricingReviewService $service,
    ) {}

    /**
     * GET /cost-management/pricing-reviews
     */
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status', 'pending');
        $search = $request->query('search');
        $productId = $request->query('product_id');
        $brandId = $request->query('brand_id');
        $perPage = (int) $request->query('per_page', 20);

        $query = PricingReview::query()
            ->with(['product.unit', 'product.brand'])
            ->latest('created_at');

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($productId) {
            $query->where('product_id', $productId);
        }

        if ($search) {
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($brandId) {
            $query->whereHas('product', function ($q) use ($brandId) {
                $q->where('brand_id', $brandId);
            });
        }

        $reviews = $query->paginate($perPage);

        // Summary counts + below-brand-margin count
        $summary = [
            'pending' => PricingReview::query()->where('status', PricingReviewStatus::Pending->value)->count(),
            'approved' => PricingReview::query()->where('status', PricingReviewStatus::Approved->value)->count(),
            'kept' => PricingReview::query()->where('status', PricingReviewStatus::Kept->value)->count(),
            'custom_price' => PricingReview::query()->where('status', PricingReviewStatus::CustomPrice->value)->count(),
            'snoozed' => PricingReview::query()->where('status', PricingReviewStatus::Snoozed->value)->count(),
            'rejected' => PricingReview::query()->where('status', PricingReviewStatus::Rejected->value)->count(),
            'below_brand_margin' => 0, // computed client-side from brand.default_target_margin vs current_margin
            'pending_publish' => PricingReview::query()->where('publish_status', 'pending_publish')->count(),
        ];

        return response()->json([
            'data' => PricingReviewResource::collection($reviews->items()),
            'pagination' => [
                'total' => $reviews->total(),
                'per_page' => $reviews->perPage(),
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
            ],
            'summary' => $summary,
        ]);
    }

    /**
     * GET /cost-management/pricing-reviews/{id}/detail
     */
    public function detail(string $id): JsonResponse
    {
        $review = PricingReview::query()
            ->with([
                'product.unit',
                'product.brand',
                'product.activeRecipe.components',
                'approvals',
                'company',
            ])
            ->findOrFail($id);

        $resource = new PricingReviewResource($review);
        $data = $resource->toArray(request());

        $data['approvals'] = $review->approvals->map(fn ($a) => [
            'id' => $a->id,
            'action' => $a->action,
            'old_selling_price' => $a->old_selling_price,
            'new_selling_price' => $a->new_selling_price,
            'custom_price' => $a->custom_price,
            'reason' => $a->reason,
            'manager_name' => $a->manager_name,
            'approved_channels' => $a->approved_channels ?? [],
            'approved_at' => $a->approved_at?->toIso8601String(),
        ])->values()->toArray();

        return response()->json(['data' => $data]);
    }

    /**
     * POST /cost-management/pricing-reviews/{id}/approve
     */
    public function approve(ApprovePricingReviewRequest $request, string $id): JsonResponse
    {
        $review = PricingReview::query()->findOrFail($id);

        if ($review->status->isResolved()) {
            return response()->json(['message' => 'This review has already been resolved.'], 422);
        }

        $approval = $this->service->resolve(
            review: $review,
            action: $request->validated('action'),
            customPrice: $request->validated('custom_price') !== null
                ? (float) $request->validated('custom_price')
                : null,
            reason: $request->validated('reason'),
            managerName: $request->validated('manager_name'),
            channels: (array) ($request->validated('channels') ?? []),
            approverId: $request->user()?->id,
        );

        return response()->json([
            'message' => 'Pricing review resolved.',
            'approval' => [
                'id' => $approval->id,
                'action' => $approval->action,
                'new_selling_price' => $approval->new_selling_price,
                'approved_channels' => $approval->approved_channels ?? [],
                'approved_at' => $approval->approved_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * PATCH /cost-management/pricing-reviews/{id}/inline
     * Inline editing: target_margin, markup, regular_price, sale_price.
     */
    public function inline(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'target_margin' => ['nullable', 'numeric', 'min:0', 'max:99.9999'],
            'markup' => ['nullable', 'numeric', 'min:0'],
            'regular_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'pricing_mode' => ['nullable', 'string', 'in:brand_policy,custom'],
        ]);

        $review = PricingReview::query()->with(['product.brand', 'company'])->findOrFail($id);
        $product = $review->product;
        $updated = [];

        // Resolve target_margin from either input
        $newMargin = null;
        if ($request->filled('markup')) {
            $mk = (float) $request->input('markup');
            $newMargin = round($mk / (100 + $mk) * 100, 4);
        } elseif ($request->filled('target_margin')) {
            $newMargin = (float) $request->input('target_margin');
        }

        if ($newMargin !== null) {
            $suggestedPrice = $newMargin < 100
                ? round($review->product_cost / (1 - $newMargin / 100), 4)
                : $review->product_cost;
            $discountPct = $product->effectiveDiscountPct();
            $suggestedSalePrice = round($suggestedPrice * (1 - $discountPct / 100), 4);

            $review->update([
                'target_margin' => $newMargin,
                'suggested_selling_price' => $suggestedPrice,
                'suggested_sale_price' => $suggestedSalePrice,
            ]);

            // Update product custom policy
            $product->update([
                'pricing_mode' => 'custom',
                'custom_target_margin' => $newMargin,
                'custom_markup' => $newMargin < 100
                    ? round($newMargin / (100 - $newMargin) * 100, 4)
                    : 0.0,
            ]);

            $updated[] = 'target_margin';
        }

        if ($request->filled('pricing_mode')) {
            $mode = $request->input('pricing_mode');
            $product->update(['pricing_mode' => $mode]);
            if ($mode === 'brand_policy') {
                $product->loadMissing('brand');
                $brandMargin = $product->brand?->default_target_margin ?? PricingReviewService::DEFAULT_TARGET_MARGIN;
                $suggestedPrice = $brandMargin < 100
                    ? round($review->product_cost / (1 - $brandMargin / 100), 4)
                    : $review->product_cost;
                $discountPct = $product->effectiveDiscountPct();
                $suggestedSalePrice = round($suggestedPrice * (1 - $discountPct / 100), 4);
                $review->update([
                    'target_margin' => $brandMargin,
                    'suggested_selling_price' => $suggestedPrice,
                    'suggested_sale_price' => $suggestedSalePrice,
                ]);
            }
            $updated[] = 'pricing_mode';
        }

        if ($request->filled('regular_price')) {
            $price = (float) $request->input('regular_price');
            $product->update(['regular_price' => $price]);
            $newMarginVal = $price > 0
                ? round(($price - $review->product_cost) / $price * 100, 4)
                : 0.0;
            $review->update([
                'selling_price' => $price,
                'current_margin' => $newMarginVal,
            ]);
            $updated[] = 'regular_price';
        }

        if ($request->has('sale_price')) {
            $product->update(['sale_price' => $request->input('sale_price')]);
            $updated[] = 'sale_price';
        }

        $review->load(['product.brand', 'product.unit', 'company']);

        return response()->json([
            'message' => 'Review updated.',
            'updated' => $updated,
            'review' => (new PricingReviewResource($review))->toArray($request),
        ]);
    }

    /**
     * POST /cost-management/pricing-reviews/{id}/snooze
     */
    public function snooze(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'until' => ['required', 'date', 'after:today'],
        ]);

        $review = PricingReview::query()->findOrFail($id);

        if ($review->status->isResolved()) {
            return response()->json(['message' => 'This review has already been resolved.'], 422);
        }

        $this->service->snooze($review, $request->validated('until'));

        return response()->json(['message' => 'Review snoozed.']);
    }

    /**
     * POST /cost-management/pricing-reviews/{id}/assign
     */
    public function assign(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'reviewer_name' => ['required', 'string', 'max:255'],
        ]);

        $review = PricingReview::query()->findOrFail($id);
        $this->service->assign($review, $request->validated('reviewer_name'));

        return response()->json(['message' => 'Reviewer assigned.']);
    }

    /**
     * POST /cost-management/pricing-reviews/bulk-approve
     */
    public function bulkApprove(ApprovePricingReviewRequest $request): JsonResponse
    {
        $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        $ids = (array) $request->input('ids', []);
        $reviews = PricingReview::query()->whereIn('id', $ids)->get();

        $resolved = 0;
        $skipped = 0;

        foreach ($reviews as $review) {
            if ($review->status->isResolved()) {
                $skipped++;

                continue;
            }

            $this->service->resolve(
                review: $review,
                action: $request->validated('action'),
                customPrice: $request->validated('custom_price') !== null
                    ? (float) $request->validated('custom_price')
                    : null,
                reason: $request->validated('reason'),
                managerName: $request->validated('manager_name'),
                channels: (array) ($request->validated('channels') ?? []),
                approverId: $request->user()?->id,
            );

            $resolved++;
        }

        return response()->json([
            'message' => "Bulk approval complete: {$resolved} resolved, {$skipped} skipped.",
            'resolved' => $resolved,
            'skipped' => $skipped,
        ]);
    }

    /**
     * POST /cost-management/pricing-reviews/bulk-policy
     * Apply brand policy, set target margin, or set markup to multiple reviews at once.
     */
    public function bulkPolicy(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
            'action' => ['required', 'string', 'in:apply_brand_policy,set_target_margin,set_markup,snooze'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'snooze_until' => ['nullable', 'date', 'after:today'],
        ]);

        $ids = (array) $request->input('ids');
        $action = (string) $request->input('action');
        $reviews = PricingReview::query()->with(['product.brand'])->whereIn('id', $ids)->get();

        $processed = 0;

        foreach ($reviews as $review) {
            $product = $review->product;

            switch ($action) {
                case 'apply_brand_policy':
                    $brandMargin = $product?->brand?->default_target_margin ?? PricingReviewService::DEFAULT_TARGET_MARGIN;
                    $brandDiscountPct = $product?->brand?->default_discount_pct ?? 0.0;
                    $product?->update(['pricing_mode' => 'brand_policy']);
                    $suggestedPrice = $brandMargin < 100
                        ? round($review->product_cost / (1 - $brandMargin / 100), 4)
                        : $review->product_cost;
                    $review->update([
                        'target_margin' => $brandMargin,
                        'suggested_selling_price' => $suggestedPrice,
                        'suggested_sale_price' => round($suggestedPrice * (1 - $brandDiscountPct / 100), 4),
                    ]);
                    break;

                case 'set_target_margin':
                    $margin = (float) ($request->input('value') ?? PricingReviewService::DEFAULT_TARGET_MARGIN);
                    $suggestedPrice = $margin < 100
                        ? round($review->product_cost / (1 - $margin / 100), 4)
                        : $review->product_cost;
                    $discountPct = $product?->effectiveDiscountPct() ?? 0.0;
                    $review->update([
                        'target_margin' => $margin,
                        'suggested_selling_price' => $suggestedPrice,
                        'suggested_sale_price' => round($suggestedPrice * (1 - $discountPct / 100), 4),
                    ]);
                    $product?->update([
                        'pricing_mode' => 'custom',
                        'custom_target_margin' => $margin,
                        'custom_markup' => $margin < 100 ? round($margin / (100 - $margin) * 100, 4) : 0.0,
                    ]);
                    break;

                case 'set_markup':
                    $mk = (float) ($request->input('value') ?? 0);
                    $margin = round($mk / (100 + $mk) * 100, 4);
                    $suggestedPrice = $margin < 100
                        ? round($review->product_cost / (1 - $margin / 100), 4)
                        : $review->product_cost;
                    $discountPct = $product?->effectiveDiscountPct() ?? 0.0;
                    $review->update([
                        'target_margin' => $margin,
                        'suggested_selling_price' => $suggestedPrice,
                        'suggested_sale_price' => round($suggestedPrice * (1 - $discountPct / 100), 4),
                    ]);
                    $product?->update([
                        'pricing_mode' => 'custom',
                        'custom_target_margin' => $margin,
                        'custom_markup' => $mk,
                    ]);
                    break;

                case 'snooze':
                    if (! $review->status->isResolved()) {
                        $until = $request->input('snooze_until') ?? now()->addDays(3)->toDateString();
                        $this->service->snooze($review, $until);
                    }
                    break;
            }

            $processed++;
        }

        return response()->json([
            'message' => "Bulk policy applied: {$processed} reviews updated.",
            'processed' => $processed,
        ]);
    }

    /**
     * POST /cost-management/pricing-reviews/{id}/publish
     *
     * Manually publish staged prices for an approval_only review.
     * Only valid when publish_status = 'pending_publish'.
     */
    public function publish(string $id): JsonResponse
    {
        $review = PricingReview::query()
            ->with(['product'])
            ->findOrFail($id);

        if ($review->publish_status !== 'pending_publish') {
            return response()->json(['message' => 'This review is not pending publish.'], 422);
        }

        if ($review->approved_price === null) {
            return response()->json(['message' => 'No approved price stored for this review.'], 422);
        }

        $product = $review->product;

        $product->update([
            'regular_price' => $review->approved_price,
            'sale_price' => ($review->approved_sale_price !== null && $review->approved_sale_price > 0.0)
                ? $review->approved_sale_price
                : null,
        ]);

        ProductMapping::query()
            ->where('product_id', $product->id)
            ->update(['sync_status' => SyncStatus::Pending->value]);

        $review->update([
            'publish_status' => 'published',
            'published_at' => now(),
        ]);

        return response()->json(['message' => 'Prices published successfully.']);
    }

    /**
     * GET /cost-management/pricing-reviews/badge
     *
     * Lightweight endpoint for the nav badge and dashboard widget.
     */
    public function badge(Request $request): JsonResponse
    {
        $companyId = $request->query('company_id');

        $base = PricingReview::query()
            ->where('status', PricingReviewStatus::Pending->value);

        if ($companyId) {
            $base->where('company_id', $companyId);
        }

        $pending = (clone $base)->count();

        $increases = (clone $base)
            ->selectRaw('COALESCE(SUM(CASE WHEN cost_difference > 0 THEN cost_difference ELSE 0 END), 0) AS total')
            ->value('total') ?? 0;

        $decreases = (clone $base)
            ->selectRaw('COALESCE(SUM(CASE WHEN cost_difference < 0 THEN ABS(cost_difference) ELSE 0 END), 0) AS total')
            ->value('total') ?? 0;

        $productsIncreased = (clone $base)->where('cost_difference', '>', 0)->count();
        $productsDecreased = (clone $base)->where('cost_difference', '<', 0)->count();

        $largestIncrease = (clone $base)
            ->where('cost_difference', '>', 0)
            ->max('cost_difference') ?? 0;

        $largestDecrease = (clone $base)
            ->where('cost_difference', '<', 0)
            ->selectRaw('MAX(ABS(cost_difference)) AS val')
            ->value('val') ?? 0;

        return response()->json([
            'data' => [
                'pending' => $pending,
                'total_cost_increase' => round((float) $increases, 4),
                'total_cost_decrease' => round((float) $decreases, 4),
                'products_increased' => $productsIncreased,
                'products_decreased' => $productsDecreased,
                'largest_increase' => round((float) $largestIncrease, 4),
                'largest_decrease' => round((float) $largestDecrease, 4),
            ],
        ]);
    }
}
