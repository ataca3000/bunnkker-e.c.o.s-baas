<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepairHistory extends Model
{
    protected $table = 'engineering_repair_history';

    public $timestamps = false;

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'session_id',
        'company_id',
        'event_type',
        'event_data',
        'actor_id',
        'occurred_at',
    ];

    public function casts(): array
    {
        return [
            'event_data'  => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(RepairSession::class, 'session_id');
    }
}
