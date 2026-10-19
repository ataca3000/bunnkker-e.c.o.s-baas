<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class EngineeringAgentCapability extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'engineering_agent_capabilities';

    protected $fillable = [
        'agent_id',
        'capability_key',
        'capability_version',
        'proficiency',
    ];

    protected function casts(): array
    {
        return [
            'proficiency' => 'integer',
        ];
    }

    // Relations

    public function agent(): BelongsTo
    {
        return $this->belongsTo(EngineeringAgent::class, 'agent_id');
    }
}
