<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Configuration\Domain\Models\BrandPolicy;
use Modules\Admin\Configuration\Domain\Models\BrandShippingRule;
use Modules\Admin\Configuration\Domain\Models\DeliveryGeography;
use Modules\Admin\Configuration\Domain\Models\DeliveryWindow;
use Modules\Admin\Configuration\Domain\Models\DeliveryZone;
use Modules\Admin\Configuration\Domain\Models\MasterGovernorate;
use Modules\Admin\Configuration\Domain\Models\MasterZone;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Organization\Brands\Domain\Models\Brand;

/**
 * Brand Delivery Coverage Management.
 *
 * GET  /configuration/brands/{brandId}/coverage            → master overlay (27 govs + brand config)
 * GET  /configuration/brands/{brandId}/coverage-stats      → coverage statistics
 * GET  /configuration/brands/{brandId}/health-score        → configuration health score
 * POST /configuration/brands/{brandId}/clone-from/{source} → clone config from another brand
 */
final class BrandCoverageController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly ConfigAuditService $audit) {}

    // ── Master Coverage Overlay ─────────────────────────────────────────────────

    public function coverage(string $brandId): JsonResponse
    {
        $masterGovs = MasterGovernorate::with(['zones' => fn ($q) => $q->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();

        // Brand geographies: keyed by master_governorate_id for linked records
        $allBrandGeos = DeliveryGeography::where('brand_id', $brandId)->get();
        $brandGeosByMaster = $allBrandGeos->whereNotNull('master_governorate_id')->keyBy('master_governorate_id');
        $brandGeosByName = $allBrandGeos->whereNull('master_governorate_id')
            ->keyBy(fn ($g) => strtolower((string) $g->name));

        // Brand zones keyed by master_zone_id
        $brandZones = DeliveryZone::where('brand_id', $brandId)
            ->whereNotNull('master_zone_id')
            ->get()
            ->keyBy('master_zone_id');

        $result = $masterGovs->map(function (MasterGovernorate $gov) use (
            $brandGeosByMaster, $brandGeosByName, $brandZones
        ) {
            $brandGeo = $brandGeosByMaster->get($gov->id)
                     ?? $brandGeosByName->get(strtolower($gov->name));

            $zones = $gov->zones->map(function (MasterZone $mz) use ($brandZones) {
                $brandZone = $brandZones->get($mz->id);

                return [
                    'id' => $mz->id,
                    'name' => $mz->name,
                    'sort_order' => $mz->sort_order,
                    'is_enabled' => $brandZone?->is_active ?? true,
                    'custom_shipping_cost' => $brandZone?->custom_shipping_cost,
                    'zone_id' => $brandZone?->id,
                ];
            });

            return [
                'id' => $gov->id,
                'name' => $gov->name,
                'name_ar' => $gov->name_ar,
                'code' => $gov->code,
                'sort_order' => $gov->sort_order,
                'is_enabled' => $brandGeo?->is_active ?? false,
                'default_shipping_cost' => $brandGeo?->default_shipping_cost,
                'geo_id' => $brandGeo?->id,
                'total_zones' => $gov->zones->count(),
                'enabled_zones' => $zones->where('is_enabled', true)->count(),
                'zones' => $zones->values(),
            ];
        });

        return $this->success($result);
    }

    // ── Coverage Statistics ────────────────────────────────────────────────────

    public function stats(string $brandId): JsonResponse
    {
        $totalGovernorates = MasterGovernorate::count() ?: 27;
        $totalZones = MasterZone::count();

        $geos = DeliveryGeography::where('brand_id', $brandId)
            ->with(['zones' => fn ($q) => $q->with('shippingRule')])
            ->get();

        $allZones = $geos->flatMap(fn ($g) => $g->zones);
        $activeZones = $allZones->where('is_active', true);
        $enabledGeos = $geos->where('is_active', true);

        // Effective cost: custom_shipping_cost (new) → zone shipping rule (legacy) → geo default
        $costs = $activeZones->map(function (DeliveryZone $zone) use ($geos) {
            $geo = $geos->firstWhere('id', $zone->delivery_geography_id);

            return $zone->custom_shipping_cost
                ?? $zone->shippingRule?->shipping_cost
                ?? $geo?->default_shipping_cost;
        })->filter()->values();

        $avgCost = $costs->count() > 0 ? round($costs->avg(), 2) : null;

        $coveredNames = $enabledGeos->pluck('name')->map(fn ($n) => strtolower($n))->flip()->toArray();
        $allMasterNames = MasterGovernorate::orderBy('sort_order')->pluck('name')->toArray()
            ?: self::egyptGovernorateNames();

        $uncovered = array_values(
            array_filter($allMasterNames, fn ($n) => ! isset($coveredNames[strtolower($n)])),
        );

        return $this->success([
            'enabled_governorates' => $enabledGeos->count(),
            'total_governorates' => $totalGovernorates,
            'coverage_percentage' => $totalGovernorates > 0
                ? round(($enabledGeos->count() / $totalGovernorates) * 100, 1)
                : 0,
            'active_zones' => $activeZones->count(),
            'total_zones' => $totalZones ?: $allZones->count(),
            'avg_effective_shipping' => $avgCost,
            'uncovered_governorates' => $uncovered,
        ]);
    }

    // ── Configuration Health Score ──────────────────────────────────────────────

    public function healthScore(string $brandId): JsonResponse
    {
        Brand::findOrFail($brandId);

        $checks = [
            'channels' => Channel::where('brand_id', $brandId)->where('is_active', true)->exists(),
            'delivery_coverage' => DeliveryGeography::where('brand_id', $brandId)->where('is_active', true)->exists(),
            'delivery_zones' => DeliveryZone::where('brand_id', $brandId)->where('is_active', true)->exists(),
            'delivery_windows' => DeliveryWindow::where('brand_id', $brandId)->where('is_enabled', true)->exists(),
            'shipping_prices' => BrandShippingRule::where('brand_id', $brandId)->where('is_enabled', true)->exists()
                                        || DeliveryGeography::where('brand_id', $brandId)->whereNotNull('default_shipping_cost')->exists(),
            'pricing_policy' => BrandPolicy::where('brand_id', $brandId)->where('policy_group', 'pricing')->exists(),
            'preparation_policy' => BrandPolicy::where('brand_id', $brandId)->where('policy_group', 'preparation')->exists(),
            'inventory_policy' => BrandPolicy::where('brand_id', $brandId)->where('policy_group', 'inventory')->exists(),
            'manufacturing_policy' => BrandPolicy::where('brand_id', $brandId)->where('policy_group', 'manufacturing')->exists(),
            'workflow_policy' => BrandPolicy::where('brand_id', $brandId)->where('policy_group', 'workflow')->exists(),
            'ai_configuration' => BrandPolicy::where('brand_id', $brandId)->where('policy_group', 'ai')->exists(),
            'integrations' => BrandPolicy::where('brand_id', $brandId)->where('policy_group', 'integration')->exists(),
        ];

        $passed = count(array_filter($checks));
        $total = count($checks);
        $score = $total > 0 ? (int) round(($passed / $total) * 100) : 0;

        return $this->success([
            'score' => $score,
            'passed' => $passed,
            'total' => $total,
            'is_ready' => $passed === $total,
            'checks' => $checks,
        ]);
    }

    // ── Clone Configuration ─────────────────────────────────────────────────────

    public function cloneFrom(Request $request, string $brandId, string $sourceBrandId): JsonResponse
    {
        $request->validate([
            'copy_geographies' => 'nullable|boolean',
            'copy_zones' => 'nullable|boolean',
            'copy_windows' => 'nullable|boolean',
        ]);

        $copyGeos = $request->boolean('copy_geographies', true);
        $copyZones = $request->boolean('copy_zones', true);
        $copyWindows = $request->boolean('copy_windows', true);

        Brand::findOrFail($brandId);
        Brand::findOrFail($sourceBrandId);

        $companyId = Auth::user()?->company_id ?? '';
        $actorId = Auth::id() ?? '';

        $stats = DB::transaction(function () use (
            $brandId, $sourceBrandId, $companyId, $actorId,
            $copyGeos, $copyZones, $copyWindows
        ) {
            $clonedGeos = $clonedZones = $clonedWindows = 0;

            if ($copyGeos) {
                $sourceGeos = DeliveryGeography::where('brand_id', $sourceBrandId)
                    ->with(['zones.shippingRule'])
                    ->get();

                foreach ($sourceGeos as $srcGeo) {
                    // Upsert geography
                    $geo = DeliveryGeography::firstOrCreate(
                        ['brand_id' => $brandId, 'name' => $srcGeo->name],
                        [
                            'company_id' => $companyId,
                            'name_ar' => $srcGeo->name_ar,
                            'code' => $srcGeo->code,
                            'sort_order' => $srcGeo->sort_order,
                            'is_active' => $srcGeo->is_active,
                            'default_shipping_cost' => $srcGeo->default_shipping_cost,
                            'created_by' => $actorId,
                            'updated_by' => $actorId,
                        ],
                    );

                    if ($geo->wasRecentlyCreated) {
                        $clonedGeos++;
                    } else {
                        $geo->update([
                            'default_shipping_cost' => $srcGeo->default_shipping_cost,
                            'is_active' => $srcGeo->is_active,
                            'updated_by' => $actorId,
                        ]);
                    }

                    if ($copyZones) {
                        foreach ($srcGeo->zones as $srcZone) {
                            $zone = DeliveryZone::firstOrCreate(
                                ['delivery_geography_id' => $geo->id, 'name' => $srcZone->name],
                                [
                                    'brand_id' => $brandId,
                                    'name_ar' => $srcZone->name_ar,
                                    'sort_order' => $srcZone->sort_order,
                                    'is_active' => $srcZone->is_active,
                                    'created_by' => $actorId,
                                    'updated_by' => $actorId,
                                ],
                            );

                            if ($zone->wasRecentlyCreated) {
                                $clonedZones++;
                            }

                            // Clone zone shipping rule (override cost)
                            if ($srcZone->shippingRule) {
                                BrandShippingRule::updateOrCreate(
                                    ['brand_id' => $brandId, 'delivery_zone_id' => $zone->id],
                                    [
                                        'company_id' => $companyId,
                                        'shipping_cost' => $srcZone->shippingRule->shipping_cost,
                                        'is_enabled' => $srcZone->shippingRule->is_enabled,
                                        'notes' => $srcZone->shippingRule->notes,
                                        'created_by' => $actorId,
                                        'updated_by' => $actorId,
                                    ],
                                );
                            }
                        }
                    }
                }
            }

            if ($copyWindows) {
                $sourceWindows = DeliveryWindow::where('brand_id', $sourceBrandId)->get();

                foreach ($sourceWindows as $srcWin) {
                    $win = DeliveryWindow::firstOrCreate(
                        ['brand_id' => $brandId, 'label' => $srcWin->label],
                        [
                            'company_id' => $companyId,
                            'starts_at' => $srcWin->starts_at,
                            'ends_at' => $srcWin->ends_at,
                            'sort_order' => $srcWin->sort_order,
                            'is_enabled' => $srcWin->is_enabled,
                            'created_by' => $actorId,
                            'updated_by' => $actorId,
                        ],
                    );

                    if ($win->wasRecentlyCreated) {
                        $clonedWindows++;
                    }
                }
            }

            return compact('clonedGeos', 'clonedZones', 'clonedWindows');
        });

        $this->audit->record(
            companyId: $companyId,
            module: 'delivery_geography',
            category: 'clone',
            action: 'create',
            oldValue: null,
            newValue: ['source_brand_id' => $sourceBrandId, ...$stats],
            brandId: $brandId,
        );

        return $this->success([
            'cloned_governorates' => $stats['clonedGeos'],
            'cloned_zones' => $stats['clonedZones'],
            'cloned_windows' => $stats['clonedWindows'],
        ], 'Configuration cloned successfully.');
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** @return list<string> */
    private static function egyptGovernorateNames(): array
    {
        return [
            'Cairo', 'Giza', 'Qalyubia', 'Alexandria', 'Beheira', 'Matruh',
            'Dakahlia', 'Sharqia', 'Gharbia', 'Monufia', 'Kafr El-Sheikh', 'Damietta',
            'Port Said', 'Ismailia', 'Suez', 'Faiyum', 'Beni Suef', 'Minya',
            'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan',
            'Red Sea', 'New Valley', 'North Sinai', 'South Sinai',
        ];
    }
}
