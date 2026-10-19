<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

final class EngineeringSchedulerEvent extends Model
{
    use HasFactory;

    protected $table = 'engineering_scheduler_events';

    protected $keyType = 'integer';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'event_type',
        'task_id',
        'worker_id',
        'policy',
        'message',
        'metadata',
        'occurred_at',
    ];

    protected $casts = [
        'metadata'    => 'array',
        'occurred_at' => 'datetime',
    ];
}
