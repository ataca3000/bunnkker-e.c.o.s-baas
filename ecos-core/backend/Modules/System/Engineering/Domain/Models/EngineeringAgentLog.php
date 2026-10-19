<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EngineeringAgentLog extends Model
{
    use HasFactory;

    protected $table = 'engineering_agent_logs';

    protected $primaryKey = 'id';

    protected $keyType = 'integer';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'agent_id',
        'session_id',
        'level',
        'message',
        'context',
        'logged_at',
    ];

    protected $casts = [
        'context'   => 'array',
        'logged_at' => 'datetime',
    ];
}
