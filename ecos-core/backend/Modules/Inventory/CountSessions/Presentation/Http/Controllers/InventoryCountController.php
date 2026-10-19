<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Presentation\Http\Controllers;

use App\Core\Company\CurrentCompanyService;
use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Modules\Inventory\CountSessions\Application\Actions\ApproveCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CancelCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CompleteCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CreateCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\StartCountSessionAction;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountLine;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountLineAttachment;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;

final class InventoryCountController extends Controller
{
    use HasApiResponse;

    private const MAX_ATTACHMENT_MB = 20;

    public function __construct(private readonly CurrentCompanyService $currentCompany) {}

    /**
     * GET /inventory-counts
     */
    public function index(Request $request): JsonResponse
    {
        $query = InventoryCountSession::query()
            ->with(['warehouse', 'company'])
            ->latest();

        if ($companyId = $this->currentCompany->id()) {
            $query->where('company_id', $companyId);
        }

        if ($warehouseId = $request->query('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $perPage = min((int) $request->query('per_page', 15), 100);
        $sessions = $query->paginate($perPage);

        $sessionIds = collect($sessions->items())->pluck('id')->all();

        // Aggregate shortage value per session from WarehouseLiabilities
        // Guard: table may not exist if migrations are pending
        $shortageValues = Schema::hasTable('warehouse_liabilities')
            ? DB::table('warehouse_liabilities')
                ->whereIn('count_session_id', $sessionIds)
                ->where('liability_type', 'inventory_shortage')
                ->select('count_session_id', DB::raw('SUM(total_cost) as shortage_value'))
                ->groupBy('count_session_id')
                ->get()
                ->keyBy('count_session_id')
            : collect();

        // Aggregate waste value per session from WasteInvestigations
        $wasteValues = Schema::hasTable('waste_investigations')
            ? DB::table('waste_investigations')
                ->whereIn('count_session_id', $sessionIds)
                ->select('count_session_id', DB::raw('SUM(total_cost) as waste_value'))
                ->groupBy('count_session_id')
                ->get()
                ->keyBy('count_session_id')
            : collect();

        // Aggregate attachment count per session
        $attachmentCounts = Schema::hasTable('inventory_count_line_attachments')
            ? DB::table('inventory_count_line_attachments')
                ->whereIn('session_id', $sessionIds)
                ->select('session_id', DB::raw('COUNT(*) as attachment_count'))
                ->groupBy('session_id')
                ->get()
                ->keyBy('session_id')
            : collect();

        return $this->success([
            'data' => collect($sessions->items())->map(function ($s) use ($shortageValues, $wasteValues, $attachmentCounts): array {
                $stats = [
                    'shortage_value' => isset($shortageValues[$s->id]) ? (float) $shortageValues[$s->id]->shortage_value : null,
                    'waste_value' => isset($wasteValues[$s->id]) ? (float) $wasteValues[$s->id]->waste_value : null,
                    'attachment_count' => isset($attachmentCounts[$s->id]) ? (int) $attachmentCounts[$s->id]->attachment_count : 0,
                ];

                return $this->formatSession($s, false, false, $stats);
            }),
            'meta' => [
                'current_page' => $sessions->currentPage(),
                'per_page' => $sessions->perPage(),
                'total' => $sessions->total(),
                'last_page' => $sessions->lastPage(),
            ],
        ]);
    }

    /**
     * POST /inventory-counts
     */
    public function store(Request $request, CreateCountSessionAction $action): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'warehouse_id' => 'required|uuid|exists:warehouses,id',
            'notes' => 'nullable|string|max:1000',
            'product_ids' => 'nullable|array',
            'product_ids.*' => 'uuid|exists:products,id',
        ]);

        $session = $action->execute($validated);

        return $this->created($this->formatSession($session->load('lines.product', 'warehouse')));
    }

    /**
     * GET /inventory-counts/{inventoryCount}
     *
     * Blind mode: system_qty is always hidden until the session is approved.
     * The hide_system_qty param is still accepted for mobile clients but the
     * server enforces the blind rule server-side regardless.
     */
    public function show(Request $request, InventoryCountSession $inventoryCount): JsonResponse
    {
        $inventoryCount->loadMissing('lines.product', 'lines.attachments', 'warehouse', 'company');

        // Enforce blind count: hide system_qty unless approved
        $hideSysQty = $inventoryCount->status->value !== 'approved';

        return $this->success($this->formatSession($inventoryCount, true, $hideSysQty));
    }

    /**
     * PUT /inventory-counts/{inventoryCount}
     *
     * Updates counted quantities and notes on count lines.
     * Only allowed while status is draft or in_progress.
     */
    public function update(Request $request, InventoryCountSession $inventoryCount): JsonResponse
    {
        if (! in_array($inventoryCount->status->value, ['draft', 'in_progress'], true)) {
            return $this->error('Count session cannot be edited in its current status.', 422);
        }

        $validated = $request->validate([
            'notes' => 'nullable|string|max:1000',
            'lines' => 'nullable|array',
            'lines.*.id' => 'required|uuid|exists:inventory_count_lines,id',
            'lines.*.counted_qty' => 'nullable|numeric|min:0',
            'lines.*.damaged_qty' => 'nullable|numeric|min:0',
            'lines.*.damage_reason' => 'nullable|string|max:100',
            'lines.*.damage_notes' => 'nullable|string|max:500',
            'lines.*.notes' => 'nullable|string|max:500',
        ]);

        if (isset($validated['notes'])) {
            $inventoryCount->update(['notes' => $validated['notes']]);
        }

        foreach ($validated['lines'] ?? [] as $lineData) {
            $updates = [];
            if (array_key_exists('counted_qty', $lineData)) {
                $updates['counted_qty'] = $lineData['counted_qty'];
            }
            if (array_key_exists('damaged_qty', $lineData)) {
                $updates['damaged_qty'] = $lineData['damaged_qty'] ?? 0;
            }
            if (array_key_exists('damage_reason', $lineData)) {
                $updates['damage_reason'] = $lineData['damage_reason'];
            }
            if (array_key_exists('damage_notes', $lineData)) {
                $updates['notes'] = $lineData['damage_notes'];
            }
            if (array_key_exists('notes', $lineData)) {
                $updates['notes'] = $lineData['notes'];
            }

            if (! empty($updates)) {
                InventoryCountLine::query()
                    ->where('id', $lineData['id'])
                    ->where('session_id', $inventoryCount->id)
                    ->update($updates);
            }
        }

        $inventoryCount->loadMissing('lines.product', 'lines.attachments', 'warehouse');

        return $this->updated($this->formatSession($inventoryCount, true, true));
    }

    /**
     * DELETE /inventory-counts/{inventoryCount}
     * Only draft sessions can be deleted.
     */
    public function destroy(InventoryCountSession $inventoryCount): JsonResponse
    {
        if ($inventoryCount->status->value !== 'draft') {
            return $this->error('Only draft count sessions can be deleted.', 422);
        }

        $inventoryCount->lines()->delete();
        $inventoryCount->delete();

        return $this->deleted();
    }

    public function start(InventoryCountSession $inventoryCount, StartCountSessionAction $action): JsonResponse
    {
        $session = $action->execute($inventoryCount);

        return $this->updated($this->formatSession($session));
    }

    public function complete(InventoryCountSession $inventoryCount, CompleteCountSessionAction $action): JsonResponse
    {
        $session = $action->execute($inventoryCount);

        return $this->updated($this->formatSession($session->load('lines.product', 'lines.attachments', 'warehouse')));
    }

    public function approve(Request $request, InventoryCountSession $inventoryCount, ApproveCountSessionAction $action): JsonResponse
    {
        $approvedBy = (string) $request->user()->id;
        $session = $action->execute($inventoryCount, $approvedBy);

        return $this->updated($this->formatSession($session->load('lines.product', 'lines.attachments', 'warehouse'), true, false));
    }

    public function cancel(InventoryCountSession $inventoryCount, CancelCountSessionAction $action): JsonResponse
    {
        $session = $action->execute($inventoryCount);

        return $this->updated($this->formatSession($session));
    }

    /**
     * GET /inventory-counts/{inventoryCount}/report
     * Returns the Final Count Report (approved sessions only).
     */
    public function report(InventoryCountSession $inventoryCount): JsonResponse
    {
        if ($inventoryCount->status->value !== 'approved') {
            return $this->error('Report is only available for approved sessions.', 422);
        }

        $inventoryCount->loadMissing('lines.product', 'lines.attachments', 'warehouse', 'company');

        $lines = $inventoryCount->lines;

        // Financial summary from liability/investigation records
        $shortageValue = (float) DB::table('warehouse_liabilities')
            ->where('count_session_id', $inventoryCount->id)
            ->where('liability_type', 'inventory_shortage')
            ->sum('total_cost');

        $wasteValue = (float) DB::table('waste_investigations')
            ->where('count_session_id', $inventoryCount->id)
            ->sum('total_cost');

        $totalSystemQty = $lines->sum(fn ($l) => (float) $l->system_qty);
        $totalCountedQty = $lines->sum(fn ($l) => (float) ($l->counted_qty ?? 0));
        $totalDamagedQty = $lines->sum(fn ($l) => (float) ($l->damaged_qty ?? 0));
        $totalShortageQty = $lines->sum(fn ($l) => (float) ($l->shortage_qty ?? 0));
        $countedLines = $lines->filter(fn ($l) => $l->counted_qty !== null)->count();
        $correctLines = $lines->filter(fn ($l) => $l->counted_qty !== null && (float) $l->variance_qty === 0.0)->count();
        $accuracyPct = $countedLines > 0 ? round($correctLines / $countedLines * 100, 2) : null;

        $investigations = DB::table('waste_investigations')
            ->where('count_session_id', $inventoryCount->id)
            ->select(['status', DB::raw('COUNT(*) as cnt'), DB::raw('SUM(total_cost) as total_value')])
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $liabilities = DB::table('warehouse_liabilities')
            ->where('count_session_id', $inventoryCount->id)
            ->select(['status', DB::raw('COUNT(*) as cnt'), DB::raw('SUM(total_cost) as total_value')])
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $productDetails = $lines->filter(fn ($l) => $l->counted_qty !== null)->map(function (InventoryCountLine $line): array {
            $costSnapshot = $line->unit_cost_snapshot !== null ? (float) $line->unit_cost_snapshot : null;
            $countedQty = (float) $line->counted_qty;
            $totalValue = $costSnapshot !== null ? round($costSnapshot * $countedQty, 2) : null;

            return [
                'id' => $line->id,
                'product_id' => $line->product_id,
                'product' => $line->product ? [
                    'id' => $line->product->id,
                    'sku' => $line->product->sku,
                    'name' => $line->product->name,
                    'image_url' => $line->product->image_url,
                ] : null,
                'system_qty' => (float) $line->system_qty,
                'counted_qty' => $countedQty,
                'damaged_qty' => (float) ($line->damaged_qty ?? 0),
                'shortage_qty' => $line->shortage_qty !== null ? (float) $line->shortage_qty : null,
                'variance_qty' => $line->variance_qty !== null ? (float) $line->variance_qty : null,
                'unit_cost_snapshot' => $costSnapshot,
                'total_value' => $totalValue,
                'damage_reason' => $line->damage_reason,
                'notes' => $line->notes,
                'attachments' => $line->relationLoaded('attachments')
                    ? $line->attachments->map(fn ($a) => $this->formatAttachment($a))->values()->toArray()
                    : [],
                'decision' => $this->lineDecision($line),
            ];
        })->values();

        return $this->success([
            'session' => [
                'id' => $inventoryCount->id,
                'count_number' => $inventoryCount->count_number,
                'warehouse' => $inventoryCount->warehouse ? ['id' => $inventoryCount->warehouse->id, 'name' => $inventoryCount->warehouse->name] : null,
                'started_at' => $inventoryCount->started_at?->toIso8601String(),
                'completed_at' => $inventoryCount->completed_at?->toIso8601String(),
                'approved_at' => $inventoryCount->updated_at?->toIso8601String(),
                'approved_by' => $inventoryCount->approved_by,
                'notes' => $inventoryCount->notes,
            ],
            'inventory_summary' => [
                'total_lines' => $lines->count(),
                'counted_lines' => $countedLines,
                'system_qty' => round($totalSystemQty, 4),
                'counted_qty' => round($totalCountedQty, 4),
                'damaged_qty' => round($totalDamagedQty, 4),
                'shortage_qty' => round($totalShortageQty, 4),
                'inventory_accuracy' => $accuracyPct,
            ],
            'financial_summary' => [
                'shortage_value' => round($shortageValue, 2),
                'waste_value' => round($wasteValue, 2),
                'total_adjustment' => round($shortageValue + $wasteValue, 2),
            ],
            'investigation_summary' => [
                'pending' => (int) ($investigations['pending_investigation']?->cnt ?? 0),
                'resolved' => (int) ($investigations['resolved']?->cnt ?? 0),
                'pending_value' => (float) ($investigations['pending_investigation']?->total_value ?? 0),
            ],
            'liability_summary' => [
                'pending' => (int) ($liabilities['pending']?->cnt ?? 0),
                'approved' => (int) ($liabilities['approved']?->cnt ?? 0),
                'pending_value' => (float) ($liabilities['pending']?->total_value ?? 0),
            ],
            'product_details' => $productDetails,
        ]);
    }

    // ─── Line Attachments ─────────────────────────────────────────────────────

    /**
     * POST /inventory-counts/{inventoryCount}/lines/{line}/attachments
     */
    public function storeAttachment(Request $request, InventoryCountSession $inventoryCount, string $lineId): JsonResponse
    {
        $line = InventoryCountLine::query()
            ->where('id', $lineId)
            ->where('session_id', $inventoryCount->id)
            ->firstOrFail();

        $request->validate([
            'file' => ['required', 'file', 'max:'.(self::MAX_ATTACHMENT_MB * 1024), 'mimes:jpg,jpeg,png,pdf,mp4,mov'],
            'description' => ['nullable', 'string', 'max:500'],
            'uploaded_by' => ['nullable', 'string', 'max:255'],
        ]);

        $file = $request->file('file');
        $path = $file->store("count-line-attachments/{$inventoryCount->id}/{$lineId}", 'local');
        $attachment = InventoryCountLineAttachment::query()->create([
            'count_line_id' => $line->id,
            'session_id' => $inventoryCount->id,
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
            'file_size' => $file->getSize(),
            'description' => $request->input('description'),
            'uploaded_by' => $request->input('uploaded_by'),
        ]);

        return response()->json(['message' => 'Attachment uploaded.', 'data' => $this->formatAttachment($attachment)], 201);
    }

    /**
     * DELETE /inventory-counts/{inventoryCount}/lines/{line}/attachments/{attachment}
     */
    public function destroyAttachment(InventoryCountSession $inventoryCount, string $lineId, string $attachmentId): JsonResponse
    {
        $attachment = InventoryCountLineAttachment::query()
            ->where('id', $attachmentId)
            ->where('count_line_id', $lineId)
            ->where('session_id', $inventoryCount->id)
            ->firstOrFail();

        Storage::disk('local')->delete($attachment->file_path);
        $attachment->delete();

        return response()->json(['message' => 'Attachment deleted.']);
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /**
     * @param  array{shortage_value?: float|null, waste_value?: float|null, attachment_count?: int}  $stats
     */
    private function formatSession(
        InventoryCountSession $session,
        bool $includeLines = false,
        bool $hideSysQty = false,
        array $stats = [],
    ): array {
        $data = [
            'id' => $session->id,
            'count_number' => $session->count_number,
            'company_id' => $session->company_id,
            'warehouse_id' => $session->warehouse_id,
            'warehouse' => $session->relationLoaded('warehouse')
                ? ['id' => $session->warehouse->id, 'name' => $session->warehouse->name]
                : null,
            'status' => $session->status->value,
            'status_label' => $session->status->label(),
            'started_at' => $session->started_at?->toIso8601String(),
            'completed_at' => $session->completed_at?->toIso8601String(),
            'notes' => $session->notes,
            'created_by' => $session->created_by,
            'approved_by' => $session->approved_by,
            'created_at' => $session->created_at?->toIso8601String(),
            'updated_at' => $session->updated_at?->toIso8601String(),
            // Financial summary (available after approval, from list aggregate or computed)
            'shortage_value' => $stats['shortage_value'] ?? null,
            'waste_value' => $stats['waste_value'] ?? null,
            'attachment_count' => $stats['attachment_count'] ?? 0,
        ];

        if ($session->relationLoaded('lines')) {
            $lines = $session->lines->map(function (InventoryCountLine $line) use ($hideSysQty): array {
                $row = [
                    'id' => $line->id,
                    'product_id' => $line->product_id,
                    'product' => $line->relationLoaded('product') && $line->product !== null
                        ? ['id' => $line->product->id, 'sku' => $line->product->sku, 'name' => $line->product->name, 'image_url' => $line->product->image_url]
                        : null,
                    'counted_qty' => $line->counted_qty !== null ? (float) $line->counted_qty : null,
                    'damaged_qty' => (float) ($line->damaged_qty ?? 0),
                    'damage_reason' => $line->damage_reason,
                    'shortage_qty' => $line->shortage_qty !== null ? (float) $line->shortage_qty : null,
                    'variance_qty' => $line->variance_qty !== null ? (float) $line->variance_qty : null,
                    'variance_value' => $line->variance_value !== null ? (float) $line->variance_value : null,
                    'unit_cost_snapshot' => $line->unit_cost_snapshot !== null ? (float) $line->unit_cost_snapshot : null,
                    'notes' => $line->notes,
                    'attachments' => $line->relationLoaded('attachments')
                        ? $line->attachments->map(fn ($a) => $this->formatAttachment($a))->values()->toArray()
                        : [],
                ];

                if (! $hideSysQty) {
                    $row['system_qty'] = (float) $line->system_qty;
                }

                return $row;
            })->values()->toArray();

            $data['lines'] = $lines;

            // Variance summary only after completion
            if (in_array($session->status->value, ['completed', 'approved'], true)) {
                $data['variance_summary'] = [
                    'total_lines' => count($lines),
                    'counted_lines' => collect($session->lines)->filter(fn ($l) => $l->counted_qty !== null)->count(),
                    'positive_lines' => collect($session->lines)->filter(fn ($l) => (float) ($l->variance_qty ?? 0) > 0)->count(),
                    'negative_lines' => collect($session->lines)->filter(fn ($l) => (float) ($l->variance_qty ?? 0) < 0)->count(),
                    'total_variance_value' => round($session->lines->sum(fn ($l) => (float) ($l->variance_value ?? 0)), 2),
                    'inventory_accuracy_pct' => $this->calcAccuracy($session),
                ];
            }

            // Aggregate financial stats from loaded lines (for detail view)
            if ($session->status->value === 'approved') {
                $data['shortage_value'] = round(
                    $session->lines->sum(fn ($l) => $l->shortage_qty > 0 ? ((float) ($l->unit_cost_snapshot ?? 0)) * (float) $l->shortage_qty : 0),
                    2,
                );
                $data['waste_value'] = round(
                    $session->lines->sum(fn ($l) => $l->damaged_qty > 0 ? ((float) ($l->unit_cost_snapshot ?? 0)) * (float) $l->damaged_qty : 0),
                    2,
                );
                $data['attachment_count'] = $session->lines->sum(fn ($l) => $l->relationLoaded('attachments') ? $l->attachments->count() : 0);
            }
        }

        return $data;
    }

    private function formatAttachment(InventoryCountLineAttachment $attachment): array
    {
        return [
            'id' => $attachment->id,
            'count_line_id' => $attachment->count_line_id,
            'file_name' => $attachment->file_name,
            'mime_type' => $attachment->mime_type,
            'file_size' => $attachment->file_size,
            'description' => $attachment->description,
            'uploaded_by' => $attachment->uploaded_by,
            'created_at' => $attachment->created_at?->toIso8601String(),
        ];
    }

    private function lineDecision(InventoryCountLine $line): string
    {
        if ($line->shortage_qty > 0 && $line->damaged_qty > 0) {
            return 'shortage_and_waste';
        }
        if ($line->shortage_qty > 0) {
            return 'shortage';
        }
        if ($line->damaged_qty > 0) {
            return 'waste';
        }
        if ((float) ($line->variance_qty ?? 0) > 0) {
            return 'overstock';
        }

        return 'match';
    }

    private function calcAccuracy(InventoryCountSession $session): ?float
    {
        $counted = $session->lines->filter(fn ($l) => $l->counted_qty !== null);
        $total = $counted->count();

        if ($total === 0) {
            return null;
        }

        $correct = $counted->filter(fn ($l) => (float) $l->variance_qty === 0.0)->count();

        return round($correct / $total * 100, 2);
    }
}
