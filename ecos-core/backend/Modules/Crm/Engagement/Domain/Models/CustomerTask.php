<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Crm\Engagement\Domain\Enums\TaskStatus;
use Modules\Crm\Engagement\Domain\Enums\TaskType;

/** A CRM actionable — a task, follow-up, appointment or meeting with a lifecycle. */
class CustomerTask extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_tasks';

    protected $fillable = [
        'company_id', 'customer_id', 'task_type', 'title', 'description', 'status', 'priority',
        'due_at', 'scheduled_at', 'location', 'assignee_id', 'created_by', 'completed_at', 'completed_by',
    ];

    protected function casts(): array
    {
        return [
            'task_type' => TaskType::class,
            'status' => TaskStatus::class,
            'due_at' => 'datetime',
            'scheduled_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function isOpen(): bool
    {
        return $this->status === TaskStatus::Open;
    }
}
