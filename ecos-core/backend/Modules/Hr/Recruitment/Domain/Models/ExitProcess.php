<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Hr\Recruitment\Domain\Enums\ChecklistItemStatus;
use Modules\Hr\Recruitment\Domain\Enums\ExitStatus;
use Modules\Hr\Recruitment\Domain\Enums\ExitType;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** Someone's departure, and everything still owed in both directions. */
class ExitProcess extends Model
{
    use HasUuids;

    protected $table = 'hr_exit_processes';

    protected $fillable = [
        'company_id', 'employee_id', 'reference', 'type', 'status',
        'notice_date', 'last_working_day', 'completed_on', 'reason', 'notes',
        'is_rehire_eligible', 'rehire_note', 'initiated_by', 'completed_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => ExitType::class,
            'status' => ExitStatus::class,
            'notice_date' => 'date',
            'last_working_day' => 'date',
            'completed_on' => 'date',
            'is_rehire_eligible' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ExitChecklistItem::class, 'exit_process_id')->orderBy('sequence');
    }

    /**
     * The mandatory items nobody has settled yet — the exact list standing between
     * this exit and completion.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, ExitChecklistItem>
     */
    public function blockingItems()
    {
        return $this->items()
            ->where('is_mandatory', true)
            ->where('status', ChecklistItemStatus::Pending->value)
            ->get();
    }

    public function canComplete(): bool
    {
        return $this->status->isOpen() && $this->blockingItems()->isEmpty();
    }

    /** How far through clearance this exit is, 0–100. */
    public function progressPercent(): float
    {
        $items = $this->items()->get();

        if ($items->isEmpty()) {
            return 0.0;
        }

        $settled = $items->filter(fn (ExitChecklistItem $i) => $i->status->isSettled())->count();

        return round(($settled / $items->count()) * 100, 1);
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', [ExitStatus::Initiated->value, ExitStatus::InProgress->value]);
    }
}
