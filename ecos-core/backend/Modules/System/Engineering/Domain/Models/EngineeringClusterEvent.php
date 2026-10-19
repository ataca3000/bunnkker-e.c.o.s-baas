<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

final class EngineeringClusterEvent extends Model
{
    use HasFactory;

    protected $table = 'engineering_cluster_events';

    protected $keyType = 'integer';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'event_type',
        'severity',
        'message',
        'context',
        'occurred_at',
    ];

    protected $casts = [
        'context'     => 'array',
        'occurred_at' => 'datetime',
    ];
}
