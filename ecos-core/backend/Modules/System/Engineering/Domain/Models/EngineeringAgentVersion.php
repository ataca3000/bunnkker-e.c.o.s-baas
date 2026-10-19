<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EngineeringAgentVersion extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'engineering_agent_versions';

    protected $fillable = [
        'agent_id',
        'version',
        'changelog',
        'is_current',
        'released_at',
    ];

    protected $casts = [
        'is_current'  => 'boolean',
        'released_at' => 'datetime',
    ];

    public function agent(): BelongsTo
    {
        return $this->belongsTo(EngineeringAgent::class, 'agent_id');
    }
}
