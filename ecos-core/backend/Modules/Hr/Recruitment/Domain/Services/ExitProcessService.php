<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Recruitment\Domain\Enums\ChecklistItemStatus;
use Modules\Hr\Recruitment\Domain\Enums\ExitStatus;
use Modules\Hr\Recruitment\Domain\Enums\ExitType;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\ExitChecklistItem;
use Modules\Hr\Recruitment\Domain\Models\ExitProcess;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Employee exit.
 *
 * ┌─ THE CHECKLIST IS A GATE, NOT A REMINDER ───────────────────────────────┐
 * │ Completion is what changes the employee record and writes the separation    │
 * │ into their history, so it is the moment the company loses its remaining      │
 * │ leverage. If the laptop is still out and the access card still works, that   │
 * │ is the moment to say so — afterwards, chasing it is somebody's favour.       │
 * │                                                                            │
 * │ MANDATORY items block. Optional ones do not, because a checklist where       │
 * │ everything blocks gets waived wholesale, and then nothing blocks.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ONE WRITER FOR THE EMPLOYEE RECORD ────────────────────────────────────┐
 * │ Completing an exit does not touch hr_employees. It calls the lifecycle       │
 * │ service, which calls EmployeeService — so termination dates, status rules    │
 * │ and the history entry are produced by the code that owns them, exactly as    │
 * │ they are when a separation is recorded by hand.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ExitProcessService
{
    /**
     * The default clearance list.
     *
     * Seeded onto each exit as ordinary rows, so an exit that has begun is not
     * disturbed by the catalogue changing underneath it — and so a company can
     * add, remove or reorder items per exit without a migration.
     *
     * key, label, category, mandatory
     */
    public const DEFAULT_CHECKLIST = [
        ['laptop_returned', 'Laptop Returned', 'asset', true],
        ['mobile_returned', 'Mobile Returned', 'asset', false],
        ['sim_returned', 'SIM Returned', 'asset', false],
        ['office_keys_returned', 'Office Keys Returned', 'asset', true],
        ['access_card_returned', 'Access Card Returned', 'asset', true],
        ['uniform_returned', 'Uniform Returned', 'asset', false],
        ['company_assets_returned', 'Company Assets Returned', 'asset', true],
        ['financial_clearance', 'Financial Clearance', 'clearance', true],
        ['it_clearance', 'IT Clearance', 'clearance', true],
        ['hr_clearance', 'HR Clearance', 'clearance', true],
        ['manager_approval', 'Manager Approval', 'approval', true],
    ];

    public function __construct(private readonly EmployeeLifecycleService $lifecycle) {}

    // ── Starting ──────────────────────────────────────────────────────────────

    /**
     * Open an exit and lay out its checklist.
     *
     * @param  array<string, mixed>  $data
     */
    public function initiate(Employee $employee, ExitType $type, array $data, ?int $actorId = null): ExitProcess
    {
        $open = ExitProcess::query()
            ->where('employee_id', $employee->id)
            ->open()
            ->first();

        if ($open !== null) {
            throw RecruitmentException::exitAlreadyOpen((string) $open->reference);
        }

        return DB::transaction(function () use ($employee, $type, $data, $actorId): ExitProcess {
            $exit = ExitProcess::create([
                'company_id' => $employee->company_id,
                'employee_id' => $employee->id,
                'reference' => $this->nextReference((string) $employee->company_id),
                'type' => $type->value,
                'status' => ExitStatus::Initiated->value,
                'notice_date' => $data['notice_date'] ?? Carbon::now()->toDateString(),
                'last_working_day' => $data['last_working_day'] ?? Carbon::now()->toDateString(),
                'reason' => $data['reason'] ?? null,
                'notes' => $data['notes'] ?? null,
                'is_rehire_eligible' => $data['is_rehire_eligible'] ?? null,
                'rehire_note' => $data['rehire_note'] ?? null,
                'initiated_by' => $actorId,
            ]);

            $this->seedChecklist($exit, $data['checklist'] ?? null, $data['responsible_employee_id'] ?? null);

            return $exit->refresh();
        });
    }

    /**
     * @param  array<int, array<string, mixed>>|null  $custom
     */
    private function seedChecklist(ExitProcess $exit, ?array $custom, mixed $defaultResponsible): void
    {
        $items = $custom ?? array_map(fn (array $row) => [
            'key' => $row[0], 'label' => $row[1], 'category' => $row[2], 'is_mandatory' => $row[3],
        ], self::DEFAULT_CHECKLIST);

        $sequence = 10;

        foreach ($items as $item) {
            ExitChecklistItem::create([
                'company_id' => $exit->company_id,
                'exit_process_id' => $exit->id,
                'key' => (string) $item['key'],
                'label' => (string) $item['label'],
                'category' => (string) ($item['category'] ?? 'asset'),
                'is_mandatory' => (bool) ($item['is_mandatory'] ?? true),
                'status' => ChecklistItemStatus::Pending->value,
                'responsible_employee_id' => $item['responsible_employee_id'] ?? $defaultResponsible,
                'due_date' => $item['due_date'] ?? $exit->last_working_day?->toDateString(),
                'sequence' => (int) ($item['sequence'] ?? $sequence),
            ]);

            $sequence += 10;
        }
    }

    // ── Working the checklist ─────────────────────────────────────────────────

    public function completeItem(ExitChecklistItem $item, array $data = [], ?int $actorId = null): ExitChecklistItem
    {
        $this->assertExitOpen($item);

        $item->update([
            'status' => ChecklistItemStatus::Completed->value,
            'completed_on' => $data['completed_on'] ?? Carbon::now()->toDateString(),
            'completed_by' => $actorId,
            'notes' => $data['notes'] ?? $item->notes,
            'file_path' => $data['file_path'] ?? $item->file_path,
            'file_name' => $data['file_name'] ?? $item->file_name,
            'mime_type' => $data['mime_type'] ?? $item->mime_type,
            'file_size' => $data['file_size'] ?? $item->file_size,
        ]);

        $this->touchProgress($item->exitProcess);

        return $item->refresh();
    }

    /** Letting a mandatory item go — allowed, but never silently. */
    public function waiveItem(ExitChecklistItem $item, string $reason, ?int $actorId = null): ExitChecklistItem
    {
        $this->assertExitOpen($item);

        if (trim($reason) === '') {
            throw RecruitmentException::waiverReasonRequired();
        }

        $item->update([
            'status' => ChecklistItemStatus::Waived->value,
            'waiver_reason' => $reason,
            'waived_by' => $actorId,
            'completed_on' => Carbon::now()->toDateString(),
        ]);

        $this->touchProgress($item->exitProcess);

        return $item->refresh();
    }

    /** It never applied — a driver has no laptop. Not the same as waiving. */
    public function markItemNotApplicable(ExitChecklistItem $item, ?string $note = null, ?int $actorId = null): ExitChecklistItem
    {
        $this->assertExitOpen($item);

        $item->update([
            'status' => ChecklistItemStatus::NotApplicable->value,
            'notes' => $note ?? $item->notes,
            'completed_by' => $actorId,
            'completed_on' => Carbon::now()->toDateString(),
        ]);

        $this->touchProgress($item->exitProcess);

        return $item->refresh();
    }

    public function reopenItem(ExitChecklistItem $item): ExitChecklistItem
    {
        $this->assertExitOpen($item);

        $item->update([
            'status' => ChecklistItemStatus::Pending->value,
            'completed_on' => null,
            'completed_by' => null,
            'waiver_reason' => null,
            'waived_by' => null,
        ]);

        return $item->refresh();
    }

    /** Add an item the standard list did not anticipate. */
    public function addItem(ExitProcess $exit, array $data): ExitChecklistItem
    {
        if (! $exit->status->isOpen()) {
            throw RecruitmentException::exitNotOpen($exit->status->value);
        }

        return ExitChecklistItem::create([
            'company_id' => $exit->company_id,
            'exit_process_id' => $exit->id,
            'key' => (string) ($data['key'] ?? 'custom_'.uniqid()),
            'label' => (string) $data['label'],
            'category' => (string) ($data['category'] ?? 'asset'),
            'is_mandatory' => (bool) ($data['is_mandatory'] ?? false),
            'status' => ChecklistItemStatus::Pending->value,
            'responsible_employee_id' => $data['responsible_employee_id'] ?? null,
            'due_date' => $data['due_date'] ?? $exit->last_working_day?->toDateString(),
            'notes' => $data['notes'] ?? null,
            'sequence' => (int) ($data['sequence'] ?? 900),
        ]);
    }

    // ── Finishing ─────────────────────────────────────────────────────────────

    /**
     * Complete the exit: the gate, then the employee record.
     *
     * @param  array<string, mixed>  $data
     */
    public function complete(ExitProcess $exit, array $data = [], ?int $actorId = null): ExitProcess
    {
        if (! $exit->status->canTransitionTo(ExitStatus::Completed)) {
            throw RecruitmentException::invalidExitTransition($exit->status->value, ExitStatus::Completed->value);
        }

        $blocking = $exit->blockingItems();

        if ($blocking->isNotEmpty()) {
            throw RecruitmentException::exitBlockedByChecklist($blocking->count());
        }

        return DB::transaction(function () use ($exit, $data, $actorId): ExitProcess {
            $employee = $exit->employee;

            if ($employee !== null) {
                // Through the lifecycle service, which goes through EmployeeService.
                // Nothing here writes hr_employees directly.
                $this->lifecycle->separate(
                    $employee,
                    (string) ($exit->reason ?? $exit->type->label()),
                    $exit->type->isVoluntary(),
                    $exit->last_working_day?->toDateString(),
                    $actorId,
                );
            }

            $exit->update([
                'status' => ExitStatus::Completed->value,
                'completed_on' => $data['completed_on'] ?? Carbon::now()->toDateString(),
                'completed_by' => $actorId,
                'is_rehire_eligible' => $data['is_rehire_eligible'] ?? $exit->is_rehire_eligible,
                'rehire_note' => $data['rehire_note'] ?? $exit->rehire_note,
                'notes' => $data['notes'] ?? $exit->notes,
            ]);

            return $exit->refresh();
        });
    }

    public function cancel(ExitProcess $exit, string $reason, ?int $actorId = null): ExitProcess
    {
        if (! $exit->status->canTransitionTo(ExitStatus::Cancelled)) {
            throw RecruitmentException::invalidExitTransition($exit->status->value, ExitStatus::Cancelled->value);
        }

        $exit->update([
            'status' => ExitStatus::Cancelled->value,
            'notes' => trim(($exit->notes ?? '')."\nCancelled: ".$reason),
            'completed_by' => $actorId,
        ]);

        return $exit->refresh();
    }

    // ── Reading ───────────────────────────────────────────────────────────────

    /**
     * One exit, with everything standing in its way named.
     *
     * @return array<string, mixed>
     */
    public function detail(ExitProcess $exit): array
    {
        $items = $exit->items()->with('responsible:id,employee_number,first_name,last_name')->get();
        $blocking = $items->filter(fn (ExitChecklistItem $i) => $i->isBlocking());

        return [
            'id' => (string) $exit->id,
            'reference' => $exit->reference,
            'employee_id' => (string) $exit->employee_id,
            'employee' => $exit->employee === null ? null : [
                'employee_number' => $exit->employee->employee_number,
                'name' => $exit->employee->fullName(),
                'status' => $exit->employee->status->value,
            ],
            'type' => $exit->type->value,
            'type_label' => $exit->type->label(),
            'is_voluntary' => $exit->type->isVoluntary(),
            'status' => $exit->status->value,
            'status_label' => $exit->status->label(),
            'notice_date' => $exit->notice_date?->toDateString(),
            'last_working_day' => $exit->last_working_day?->toDateString(),
            'completed_on' => $exit->completed_on?->toDateString(),
            'reason' => $exit->reason,
            'notes' => $exit->notes,
            'is_rehire_eligible' => $exit->is_rehire_eligible,
            'rehire_note' => $exit->rehire_note,
            'progress_percent' => $exit->progressPercent(),
            'can_complete' => $exit->canComplete(),
            // The exact list, not a count — "3 items outstanding" tells nobody
            // which door to knock on.
            'blocking_items' => $blocking->map(fn (ExitChecklistItem $i) => [
                'id' => (string) $i->id,
                'label' => $i->label,
                'responsible' => $i->responsible?->fullName(),
                'due_date' => $i->due_date?->toDateString(),
                'is_overdue' => $i->isOverdue(),
            ])->values()->all(),
            'checklist' => $items->map(fn (ExitChecklistItem $i) => [
                'id' => (string) $i->id,
                'key' => $i->key,
                'label' => $i->label,
                'category' => $i->category,
                'is_mandatory' => (bool) $i->is_mandatory,
                'status' => $i->status->value,
                'status_label' => $i->status->label(),
                'is_blocking' => $i->isBlocking(),
                'is_overdue' => $i->isOverdue(),
                'responsible_employee_id' => $i->responsible_employee_id === null ? null : (string) $i->responsible_employee_id,
                'responsible_name' => $i->responsible?->fullName(),
                'due_date' => $i->due_date?->toDateString(),
                'completed_on' => $i->completed_on?->toDateString(),
                'notes' => $i->notes,
                'has_evidence' => $i->hasEvidence(),
                'file_name' => $i->file_name,
                'waiver_reason' => $i->waiver_reason,
                'settlement' => $i->settlement(),
            ])->values()->all(),
        ];
    }

    /**
     * Open exits, most urgent first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function openExits(string $companyId): array
    {
        return ExitProcess::query()
            ->with(['employee:id,employee_number,first_name,last_name', 'items'])
            ->where('company_id', $companyId)
            ->open()
            ->orderBy('last_working_day')
            ->get()
            ->map(fn (ExitProcess $exit) => [
                'id' => (string) $exit->id,
                'reference' => $exit->reference,
                'employee_name' => $exit->employee?->fullName(),
                'employee_number' => $exit->employee?->employee_number,
                'type' => $exit->type->value,
                'type_label' => $exit->type->label(),
                'status' => $exit->status->value,
                'last_working_day' => $exit->last_working_day?->toDateString(),
                'days_remaining' => $exit->last_working_day === null
                    ? null
                    : (int) Carbon::now()->startOfDay()->diffInDays($exit->last_working_day->startOfDay(), false),
                'progress_percent' => $exit->progressPercent(),
                'outstanding_mandatory' => $exit->items
                    ->filter(fn (ExitChecklistItem $i) => $i->isBlocking())->count(),
                'can_complete' => $exit->canComplete(),
            ])->all();
    }

    /**
     * Clearance items assigned to one person — their queue.
     *
     * @return array<int, array<string, mixed>>
     */
    public function itemsAssignedTo(string $companyId, string $employeeId): array
    {
        return ExitChecklistItem::query()
            ->with('exitProcess.employee:id,employee_number,first_name,last_name')
            ->where('company_id', $companyId)
            ->where('responsible_employee_id', $employeeId)
            ->where('status', ChecklistItemStatus::Pending->value)
            ->orderBy('due_date')
            ->get()
            ->filter(fn (ExitChecklistItem $i) => $i->exitProcess?->status->isOpen() === true)
            ->map(fn (ExitChecklistItem $i) => [
                'id' => (string) $i->id,
                'label' => $i->label,
                'category' => $i->category,
                'is_mandatory' => (bool) $i->is_mandatory,
                'due_date' => $i->due_date?->toDateString(),
                'is_overdue' => $i->isOverdue(),
                'exit_reference' => $i->exitProcess?->reference,
                'leaver_name' => $i->exitProcess?->employee?->fullName(),
                'last_working_day' => $i->exitProcess?->last_working_day?->toDateString(),
            ])->values()->all();
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function assertExitOpen(ExitChecklistItem $item): void
    {
        $exit = $item->exitProcess;

        if ($exit === null || ! $exit->status->isOpen()) {
            throw RecruitmentException::exitNotOpen($exit?->status->value ?? 'missing');
        }
    }

    /** The first settled item moves the exit from initiated to in progress. */
    private function touchProgress(?ExitProcess $exit): void
    {
        if ($exit === null || $exit->status !== ExitStatus::Initiated) {
            return;
        }

        $exit->update(['status' => ExitStatus::InProgress->value]);
    }

    private function nextReference(string $companyId): string
    {
        $last = ExitProcess::query()
            ->where('company_id', $companyId)
            ->where('reference', 'like', 'EXT-%')
            ->orderByDesc('reference')
            ->value('reference');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'EXT-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }
}
