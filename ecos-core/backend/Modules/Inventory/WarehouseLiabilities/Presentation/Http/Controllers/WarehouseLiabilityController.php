<?php

declare(strict_types=1);

namespace Modules\Inventory\WarehouseLiabilities\Presentation\Http\Controllers;

use App\Core\Company\CurrentCompanyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\WarehouseLiabilities\Application\Actions\ApproveWarehouseLiabilityAction;
use Modules\Inventory\WarehouseLiabilities\Domain\Models\WarehouseLiability;

class WarehouseLiabilityController extends Controller
{
    public function __construct(
        private readonly ApproveWarehouseLiabilityAction $approveAction,
        private readonly CurrentCompanyService $currentCompany,
    ) {}

    // ─── List / Show ─────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $status = $request->query('status');
        $warehouseId = $request->query('warehouse_id');
        $month = $request->query('month');
        $type = $request->query('liability_type');

        $query = WarehouseLiability::query()
            ->with(['product:id,name,sku,image_url', 'warehouse:id,name', 'countSession:id,count_number'])
            ->latest();

        if ($companyId = $this->currentCompany->id()) {
            $query->where('company_id', $companyId);
        }

        if ($status) {
            $query->where('status', $status);
        }
        if ($warehouseId) {
            $query->where('warehouse_id', $warehouseId);
        }
        if ($month) {
            $query->where('month', $month);
        }
        if ($type) {
            $query->where('liability_type', $type);
        }

        $results = $query->paginate($perPage);

        $companyScope = fn ($q) => $companyId ? $q->where('company_id', $companyId) : $q;
        $summary = [
            'pending' => WarehouseLiability::query()->tap($companyScope)->where('status', 'pending')->count(),
            'approved' => WarehouseLiability::query()->tap($companyScope)->where('status', 'approved')->count(),
            'rejected' => WarehouseLiability::query()->tap($companyScope)->where('status', 'rejected')->count(),
            'total_pending_value' => WarehouseLiability::query()->tap($companyScope)->where('status', 'pending')->sum('total_cost'),
            'total_approved_value' => WarehouseLiability::query()->tap($companyScope)->where('status', 'approved')->sum('cost_snapshot_total_value'),
        ];

        return response()->json([
            'data' => $results->items(),
            'pagination' => [
                'total' => $results->total(),
                'per_page' => $results->perPage(),
                'current_page' => $results->currentPage(),
                'last_page' => $results->lastPage(),
            ],
            'summary' => $summary,
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $liability = WarehouseLiability::query()
            ->with(['product', 'warehouse', 'countSession', 'countLine', 'wasteInvestigation'])
            ->findOrFail($id);

        return response()->json(['data' => $liability]);
    }

    // ─── Approve / Reject ────────────────────────────────────────────────────

    public function approve(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'approved_by' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $liability = WarehouseLiability::query()->findOrFail($id);

        $approved = $this->approveAction->execute(
            liability: $liability,
            approvedBy: $request->validated('approved_by'),
            notes: $request->validated('notes'),
        );

        return response()->json([
            'message' => 'Warehouse liability approved. Inventory adjusted.',
            'data' => $approved->load(['product', 'warehouse']),
        ]);
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'rejected_by' => ['required', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $liability = WarehouseLiability::query()->findOrFail($id);

        $rejected = $this->approveAction->reject(
            liability: $liability,
            rejectedBy: $request->validated('rejected_by'),
            reason: $request->validated('reason'),
        );

        return response()->json([
            'message' => 'Warehouse liability rejected.',
            'data' => $rejected,
        ]);
    }

    // ─── Report ───────────────────────────────────────────────────────────────

    public function report(Request $request): JsonResponse
    {
        $month = $request->query('month', now()->format('Y-m'));
        $warehouseId = $request->query('warehouse_id');

        $base = WarehouseLiability::query()->where('month', $month);
        if ($warehouseId) {
            $base->where('warehouse_id', $warehouseId);
        }

        $pending = (clone $base)->where('status', 'pending');
        $approved = (clone $base)->where('status', 'approved');
        $rejected = (clone $base)->where('status', 'rejected');

        // Warehouse accuracy: liabilities / total count lines in approved sessions this month
        // Simplified: (approved shortage qty / total system qty in counts this month) expressed as %
        $byWarehouse = WarehouseLiability::query()
            ->where('month', $month)
            ->with('warehouse:id,name')
            ->selectRaw('warehouse_id, warehouse_manager, status, sum(cost_snapshot_total_value) as approved_value, sum(total_cost) as total_cost, count(*) as count')
            ->groupBy('warehouse_id', 'warehouse_manager', 'status')
            ->get();

        $byManager = WarehouseLiability::query()
            ->where('month', $month)
            ->whereNotNull('warehouse_manager')
            ->selectRaw('warehouse_manager, sum(cost_snapshot_total_value) as total_approved_value, count(*) as count')
            ->where('status', 'approved')
            ->groupBy('warehouse_manager')
            ->get();

        // Monthly trend (last 6 months)
        $monthlyTrend = DB::table('warehouse_liabilities')
            ->whereRaw("month >= TO_CHAR(NOW() - INTERVAL '6 months', 'YYYY-MM')")
            ->where('status', 'approved')
            ->selectRaw('month, count(*) as count, sum(cost_snapshot_total_value) as total_value')
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return response()->json([
            'month' => $month,
            'total_shortages' => (clone $base)->where('liability_type', 'inventory_shortage')->count(),
            'total_waste_transferred' => (clone $base)->where('liability_type', 'waste_transferred')->count(),
            'pending_count' => (clone $pending)->count(),
            'approved_count' => (clone $approved)->count(),
            'rejected_count' => (clone $rejected)->count(),
            'total_pending_value' => (clone $pending)->sum('total_cost'),
            'total_approved_value' => (clone $approved)->sum('cost_snapshot_total_value'),
            'total_rejected_value' => (clone $rejected)->sum('total_cost'),
            'by_warehouse' => $byWarehouse,
            'by_manager' => $byManager,
            'monthly_trend' => $monthlyTrend,
        ]);
    }
}
