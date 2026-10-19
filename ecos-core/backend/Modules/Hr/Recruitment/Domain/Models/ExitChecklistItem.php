<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Modules\Hr\Recruitment\Domain\Enums\ChecklistItemStatus;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** One thing that has to be handed back, cleared or approved before someone goes. */
class ExitChecklistItem extends Model
{
    use HasUuids;

    protected $table = 'hr_exit_checklist_items';

    protected $fillable = [
        'company_id', 'exit_process_id', 'key', 'label', 'category', 'is_mandatory',
        'status', 'responsible_employee_id', 'due_date', 'completed_on', 'notes',
        'file_path', 'file_name', 'mime_type', 'file_size',
        'waiver_reason', 'waived_by', 'completed_by', 'sequence',
    ];

    protected function casts(): array
    {
        return [
            'status' => ChecklistItemStatus::class,
            'is_mandatory' => 'boolean',
            'due_date' => 'date',
            'completed_on' => 'date',
            'sequence' => 'integer',
            'file_size' => 'integer',
        ];
    }

    public function exitProcess(): BelongsTo
    {
        return $this->belongsTo(ExitProcess::class, 'exit_process_id');
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'responsible_employee_id');
    }

    /** Still outstanding and past its date. */
    public function isOverdue(): bool
    {
        if (! $this->status->isOutstanding() || $this->due_date === null) {
            return false;
        }

        return $this->due_date->endOfDay()->isPast();
    }

    /** Whether this item is what is holding the exit up. */
    public function isBlocking(): bool
    {
        return $this->is_mandatory && $this->status->isOutstanding();
    }

    public function hasEvidence(): bool
    {
        return $this->file_path !== null && $this->file_path !== '';
    }

    /**
     * How this item was settled, for the audit trail.
     *
     * @return array<string, mixed>
     */
    public function settlement(): array
    {
        return [
            'status' => $this->status->value,
            'completed_on' => $this->completed_on?->toDateString(),
            'completed_by' => $this->completed_by,
            'waiver_reason' => $this->waiver_reason,
            'waived_by' => $this->waived_by,
            'has_evidence' => $this->hasEvidence(),
            'was_overdue' => $this->due_date !== null
                && $this->completed_on !== null
                && $this->completed_on->gt($this->due_date),
            'days_late' => $this->due_date !== null && $this->completed_on !== null
                ? max(0, Carbon::parse($this->due_date)->diffInDays(Carbon::parse($this->completed_on), false))
                : null,
        ];
    }
}
