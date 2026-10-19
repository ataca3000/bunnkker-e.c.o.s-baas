<?php

declare(strict_types=1);

namespace App\Core\Timeline;

use Illuminate\Database\Eloquent\Model;

final class TimelineEvent extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $table = 'timeline_events';

    protected $fillable = [
        'id',
        'company_id',
        'subject_type',
        'subject_id',
        'event_type',
        'title',
        'description',
        'actor_id',
        'actor_name',
        'actor_type',
        'metadata',
        'source_module',
        'correlation_id',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
