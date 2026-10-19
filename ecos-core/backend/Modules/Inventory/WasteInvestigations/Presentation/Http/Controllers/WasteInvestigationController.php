<?php

declare(strict_types=1);

namespace Modules\Inventory\WasteInvestigations\Presentation\Http\Controllers;

use App\Core\Company\CurrentCompanyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Modules\Inventory\WasteInvestigations\Application\Actions\ResolveWasteInvestigationAction;
use Modules\Inventory\WasteInvestigations\Domain\Enums\WasteInvestigationOutcome;
use Modules\Inventory\WasteInvestigations\Domain\Models\WasteInvestigation;
use Modules\Inventory\WasteInvestigations\Domain\Models\WasteInvestigationAttachment;
use Modules\Inventory\WasteInvestigations\Domain\Models\WasteInvestigationEvent;

class WasteInvestigationController extends Controller
{
    private const MAX_FILE_MB = 20;

    public function __construct(
        private readonly ResolveWasteInvestigationAction $resolveAction,
        private readonly CurrentCompanyService $currentCompany,
    ) {}

    // ─── List / Show ─────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $status = $request->query('status');
        $warehouseId = $request->query('warehouse_id');
        $productId = $request->query('product_id');
        $month = $request->query('month');
        $search = $request->query('search');

        $query = WasteInvestigation::query()
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
        if ($productId) {
            $query->where('product_id', $productId);
        }
        if ($month) {
            $query->where('month', $month);
        }
        if ($search) {
            $query->whereHas('product', fn ($q) => $q->where('name', 'ilike', "%{$search}%")->orWhere('sku', 'ilike', "%{$search}%"),
            );
        }

        $results = $query->paginate($perPage);

        // Compute SLA fields in PHP (avoids DB-specific functions)
        $items = collect($results->items())->map(function (WasteInvestigation $inv): array {
            $data = $inv->toArray();
            $data['days_pending'] = $inv->daysOpen();
            $data['is_overdue_3'] = $inv->status->value === 'pending_investigation'
                && $inv->created_at?->lt(now()->subDays(3));
            $data['is_overdue_7'] = $inv->status->value === 'pending_investigation'
                && $inv->created_at?->lt(now()->subDays(7));

            return $data;
        });

        $pending = WasteInvestigation::query()->where('status', 'pending_investigation');
        $resolved = WasteInvestigation::query()->where('status', 'resolved');
        if ($companyId = $this->currentCompany->id()) {
            $pending->where('company_id', $companyId);
            $resolved->where('company_id', $companyId);
        }
        $summary = [
            'pending' => (clone $pending)->count(),
            'pending_over_3' => (clone $pending)->where('created_at', '<', now()->subDays(3))->count(),
            'pending_over_7' => (clone $pending)->where('created_at', '<', now()->subDays(7))->count(),
            'resolved' => $resolved->count(),
        ];

        return response()->json([
            'data' => $items->values(),
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
        $investigation = WasteInvestigation::query()
            ->with([
                'product',
                'warehouse',
                'countSession',
                'countLine',
                'attachments',
                'events' => fn ($q) => $q->orderBy('occurred_at'),
            ])
            ->findOrFail($id);

        $data = $investigation->toArray();
        $data['days_pending'] = $investigation->daysOpen();

        return response()->json(['data' => $data]);
    }

    // ─── Resolve ──────────────────────────────────────────────────────────────

    public function resolve(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'outcome' => ['required', 'string', 'in:operational_waste,warehouse_responsibility,supplier_responsibility,preparation_responsibility'],
            'resolved_by' => ['required', 'string', 'max:255'],
            'investigator_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $investigation = WasteInvestigation::query()->findOrFail($id);
        $outcome = WasteInvestigationOutcome::from($request->validated('outcome'));

        $resolved = $this->resolveAction->execute(
            investigation: $investigation,
            outcome: $outcome,
            resolvedBy: $request->validated('resolved_by'),
            investigatorNotes: $request->validated('investigator_notes'),
        );

        return response()->json([
            'message' => "Investigation resolved as {$outcome->label()}.",
            'data' => $resolved->load(['product', 'warehouse', 'events']),
        ]);
    }

    // ─── Attachments ─────────────────────────────────────────────────────────

    public function storeAttachment(Request $request, string $id): JsonResponse
    {
        WasteInvestigation::query()->findOrFail($id);

        $request->validate([
            'file' => ['required', 'file', 'max:'.(self::MAX_FILE_MB * 1024), 'mimes:pdf,jpg,jpeg,png,mp4,mov,avi'],
            'description' => ['nullable', 'string', 'max:500'],
            'uploaded_by' => ['nullable', 'string', 'max:255'],
        ]);

        $file = $request->file('file');
        $path = $file->store("waste-investigation-attachments/{$id}", 'local');
        $fileName = $file->getClientOriginalName();
        $mimeType = $file->getMimeType() ?? 'application/octet-stream';
        $fileSize = $file->getSize();
        $uploadedBy = $request->input('uploaded_by');

        $attachment = WasteInvestigationAttachment::query()->create([
            'investigation_id' => $id,
            'file_path' => $path,
            'file_name' => $fileName,
            'mime_type' => $mimeType,
            'file_size' => $fileSize,
            'description' => $request->input('description'),
            'uploaded_by' => $uploadedBy,
        ]);

        WasteInvestigationEvent::log(
            investigationId: $id,
            eventType: 'attachment_added',
            performedBy: $uploadedBy,
            description: "Attachment uploaded: {$fileName}",
        );

        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroyAttachment(string $id, string $attachmentId): JsonResponse
    {
        $attachment = WasteInvestigationAttachment::query()
            ->where('investigation_id', $id)
            ->findOrFail($attachmentId);

        Storage::disk('local')->delete($attachment->file_path);

        WasteInvestigationEvent::log(
            investigationId: $id,
            eventType: 'attachment_removed',
            description: "Attachment removed: {$attachment->file_name}",
        );

        $attachment->delete();

        return response()->json(['message' => 'Attachment deleted.']);
    }

    // ─── Report ───────────────────────────────────────────────────────────────

    public function report(Request $request): JsonResponse
    {
        $month = $request->query('month', now()->format('Y-m'));
        $warehouseId = $request->query('warehouse_id');

        $base = WasteInvestigation::query()->where('month', $month);
        if ($warehouseId) {
            $base->where('warehouse_id', $warehouseId);
        }

        $resolved = (clone $base)->where('status', 'resolved');
        $pending = (clone $base)->where('status', 'pending_investigation');

        // Average resolution time in hours (PostgreSQL)
        $avgHours = (clone $resolved)
            ->whereNotNull('resolved_at')
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours')
            ->value('avg_hours');

        // Groupings
        $byOutcome = (clone $resolved)
            ->selectRaw('outcome, count(*) as count, sum(quantity) as total_qty, sum(cost_snapshot_total_value) as total_value')
            ->groupBy('outcome')
            ->get();

        $byReason = (clone $base)
            ->selectRaw('damage_reason, count(*) as count, sum(quantity) as total_qty, sum(cost_snapshot_total_value) as total_value')
            ->groupBy('damage_reason')
            ->get();

        $byWarehouse = WasteInvestigation::query()
            ->where('month', $month)
            ->with('warehouse:id,name')
            ->selectRaw('warehouse_id, count(*) as count, sum(quantity) as total_qty, sum(cost_snapshot_total_value) as total_value')
            ->groupBy('warehouse_id')
            ->get();

        $byCategory = DB::table('waste_investigations as wi')
            ->where('wi.month', $month)
            ->join('products as p', 'wi.product_id', '=', 'p.id')
            ->leftJoin('categories as c', 'p.category_id', '=', 'c.id')
            ->selectRaw('c.name as category_name, count(*) as count, sum(wi.quantity) as total_qty, sum(wi.cost_snapshot_total_value) as total_value')
            ->groupBy('c.name')
            ->get();

        // Weekly trend within the month
        $trend = DB::table('waste_investigations')
            ->where('month', $month)
            ->selectRaw("DATE_TRUNC('week', created_at) as week, count(*) as count, sum(cost_snapshot_total_value) as total_value")
            ->groupByRaw("DATE_TRUNC('week', created_at)")
            ->orderByRaw("DATE_TRUNC('week', created_at)")
            ->get();

        return response()->json([
            'month' => $month,
            'total_items' => (clone $base)->count(),
            'pending' => (clone $pending)->count(),
            'pending_over_3_days' => (clone $pending)->where('created_at', '<', now()->subDays(3))->count(),
            'pending_over_7_days' => (clone $pending)->where('created_at', '<', now()->subDays(7))->count(),
            'resolved' => (clone $resolved)->count(),
            'total_qty' => (clone $base)->sum('quantity'),
            'total_cost' => (clone $base)->sum('cost_snapshot_total_value'),
            'avg_resolution_hours' => $avgHours ? round((float) $avgHours, 1) : null,
            'by_outcome' => $byOutcome,
            'by_reason' => $byReason,
            'by_warehouse' => $byWarehouse,
            'by_category' => $byCategory,
            'trend' => $trend,
        ]);
    }
}
