<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\CustomerEngagement\Domain\Enums\AssignmentType;

class AssignmentLog extends Model
{
    use HasUuids;

    protected $table = 'cep_assignment_logs';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'assignment_type' => AssignmentType::class,
            'unassigned_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}
