<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ValidationReport extends Model
{
    use HasUuids;

    protected $table = 'engineering_validation_reports';

    public $timestamps = false;

    protected $fillable = [
        'validation_id',
        'patch_id',
        'company_id',
        'report_type',
        'summary',
        'content',
        'generated_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'summary'      => 'array',
            'generated_at' => 'datetime',
            'created_at'   => 'datetime',
        ];
    }

    public function validation(): BelongsTo
    {
        return $this->belongsTo(PatchValidation::class, 'validation_id');
    }
}
