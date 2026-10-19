<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\GuardianDecision;

class GuardianDecisionLog extends Model
{
    protected $table = 'engineering_guardian_decisions';

    public $timestamps = false;

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'run_id',
        'company_id',
        'decision',
        'reason',
        'decided_by',
        'policy_snapshot',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'decision'        => GuardianDecision::class,
            'policy_snapshot' => 'array',
            'occurred_at'     => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(GuardianRun::class, 'run_id');
    }
}
