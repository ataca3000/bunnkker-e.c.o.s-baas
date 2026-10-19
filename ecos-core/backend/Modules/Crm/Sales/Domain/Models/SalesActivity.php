<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Crm\Sales\Domain\Enums\SalesActivityType;

/** A sales activity, reminder or follow-up on a lead or opportunity. */
class SalesActivity extends Model
{
    use HasUuids;

    protected $table = 'crm_sales_activities';

    protected $fillable = [
        'company_id', 'subject_type', 'subject_id', 'activity_type', 'title', 'body',
        'status', 'due_at', 'remind_at', 'completed_at', 'assignee_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'activity_type' => SalesActivityType::class,
            'due_at' => 'datetime',
            'remind_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
