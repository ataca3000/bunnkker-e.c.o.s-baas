<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EngineeringExecutionEvent extends Model
{
    use HasFactory;

    protected $table = 'engineering_execution_events';

    protected $primaryKey = 'id';

    protected $keyType = 'integer';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'session_id',
        'event_type',
        'level',
        'message',
        'context',
        'occurred_at',
    ];

    protected $casts = [
        'context'     => 'array',
        'occurred_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ExecutionSession::class, 'session_id');
    }
}
