<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\ValidationStepStatus;
use Modules\System\Engineering\Domain\Enums\ValidatorType;

class ValidationStep extends Model
{
    protected $table = 'engineering_validation_steps';

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'validation_id',
        'company_id',
        'validator',
        'sequence',
        'status',
        'is_blocking',
        'is_applicable',
        'exit_code',
        'output',
        'error_output',
        'duration_ms',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'validator'     => ValidatorType::class,
            'status'        => ValidationStepStatus::class,
            'sequence'      => 'integer',
            'is_blocking'   => 'boolean',
            'is_applicable' => 'boolean',
            'exit_code'     => 'integer',
            'duration_ms'   => 'integer',
            'started_at'    => 'datetime',
            'completed_at'  => 'datetime',
        ];
    }

    public function validation(): BelongsTo
    {
        return $this->belongsTo(PatchValidation::class, 'validation_id');
    }
}
