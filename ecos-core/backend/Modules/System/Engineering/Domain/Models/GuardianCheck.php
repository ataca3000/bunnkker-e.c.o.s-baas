<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\GuardianCheckCategory;
use Modules\System\Engineering\Domain\Enums\ValidationStepStatus;

class GuardianCheck extends Model
{
    protected $table = 'engineering_guardian_checks';

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'run_id',
        'company_id',
        'check_name',
        'category',
        'status',
        'is_blocking',
        'details',
        'evidence',
        'duration_ms',
    ];

    protected function casts(): array
    {
        return [
            'category'    => GuardianCheckCategory::class,
            'status'      => ValidationStepStatus::class,
            'is_blocking' => 'boolean',
            'evidence'    => 'array',
            'duration_ms' => 'integer',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(GuardianRun::class, 'run_id');
    }
}
