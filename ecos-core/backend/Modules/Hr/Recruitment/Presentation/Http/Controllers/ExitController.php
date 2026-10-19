<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Recruitment\Domain\Enums\ExitType;
use Modules\Hr\Recruitment\Domain\Models\ExitChecklistItem;
use Modules\Hr\Recruitment\Domain\Models\ExitProcess;
use Modules\Hr\Recruitment\Domain\Services\ExitProcessService;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Employee exit — the process, its checklist, and the gate before completion. */
class ExitController extends Controller
{
    use ResolvesHrContext;

    public function __construct(private readonly ExitProcessService $exits) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->exits->openExits($this->companyId($request))]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->exits->detail($this->exit($request, $id))]);
    }

    /** The default clearance list, so the UI can show it before an exit exists. */
    public function checklistTemplate(): JsonResponse
    {
        return response()->json([
            'data' => array_map(fn (array $row) => [
                'key' => $row[0], 'label' => $row[1], 'category' => $row[2], 'is_mandatory' => $row[3],
            ], ExitProcessService::DEFAULT_CHECKLIST),
        ]);
    }

    public function types(): JsonResponse
    {
        return response()->json([
            'data' => array_map(fn (ExitType $t) => [
                'value' => $t->value,
                'label' => $t->label(),
                'is_voluntary' => $t->isVoluntary(),
            ], ExitType::cases()),
        ]);
    }

    public function store(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'type' => ['required', 'in:resignation,termination,retirement'],
            'last_working_day' => ['required', 'date'],
            'notice_date' => ['nullable', 'date'],
            'reason' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'is_rehire_eligible' => ['nullable', 'boolean'],
            'rehire_note' => ['nullable', 'string', 'max:300'],
            'responsible_employee_id' => ['nullable', 'string'],
        ]);

        $employee = Employee::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($employeeId);

        $exit = $this->exits->initiate(
            $employee,
            ExitType::from((string) $v['type']),
            $v,
            $this->actorId($request),
        );

        return response()->json(['data' => $this->exits->detail($exit)], 201);
    }

    public function complete(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'completed_on' => ['nullable', 'date'],
            'is_rehire_eligible' => ['nullable', 'boolean'],
            'rehire_note' => ['nullable', 'string', 'max:300'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $exit = $this->exits->complete($this->exit($request, $id), $v, $this->actorId($request));

        return response()->json(['data' => $this->exits->detail($exit)]);
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $exit = $this->exits->cancel($this->exit($request, $id), (string) $v['reason'], $this->actorId($request));

        return response()->json(['data' => $this->exits->detail($exit)]);
    }

    // ── Checklist items ───────────────────────────────────────────────────────

    public function addItem(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'label' => ['required', 'string', 'max:150'],
            'key' => ['nullable', 'string', 'max:60'],
            'category' => ['nullable', 'in:asset,clearance,approval'],
            'is_mandatory' => ['nullable', 'boolean'],
            'responsible_employee_id' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $this->exits->addItem($this->exit($request, $id), $v);

        return response()->json(['data' => $this->exits->detail($this->exit($request, $id))], 201);
    }

    public function completeItem(Request $request, string $itemId): JsonResponse
    {
        $v = $request->validate([
            'completed_on' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
            'file_path' => ['nullable', 'string', 'max:400'],
            'file_name' => ['nullable', 'string', 'max:200'],
            'mime_type' => ['nullable', 'string', 'max:120'],
            'file_size' => ['nullable', 'integer', 'min:0'],
        ]);

        $item = $this->exits->completeItem($this->item($request, $itemId), $v, $this->actorId($request));

        return response()->json(['data' => $this->exits->detail($item->exitProcess)]);
    }

    public function waiveItem(Request $request, string $itemId): JsonResponse
    {
        $v = $request->validate(['reason' => ['required', 'string', 'max:400']]);

        $item = $this->exits->waiveItem($this->item($request, $itemId), (string) $v['reason'], $this->actorId($request));

        return response()->json(['data' => $this->exits->detail($item->exitProcess)]);
    }

    public function notApplicableItem(Request $request, string $itemId): JsonResponse
    {
        $v = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        $item = $this->exits->markItemNotApplicable(
            $this->item($request, $itemId), $v['note'] ?? null, $this->actorId($request)
        );

        return response()->json(['data' => $this->exits->detail($item->exitProcess)]);
    }

    public function reopenItem(Request $request, string $itemId): JsonResponse
    {
        $item = $this->exits->reopenItem($this->item($request, $itemId));

        return response()->json(['data' => $this->exits->detail($item->exitProcess)]);
    }

    /** One person's clearance queue. */
    public function myItems(Request $request, string $employeeId): JsonResponse
    {
        return response()->json([
            'data' => $this->exits->itemsAssignedTo($this->companyId($request), $employeeId),
        ]);
    }

    private function exit(Request $request, string $id): ExitProcess
    {
        return ExitProcess::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($id);
    }

    private function item(Request $request, string $id): ExitChecklistItem
    {
        return ExitChecklistItem::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($id);
    }
}
