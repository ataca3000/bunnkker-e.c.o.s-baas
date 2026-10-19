<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ValidationRule extends Model
{
    use HasUuids;

    protected $table = 'engineering_validation_rules';

    protected $fillable = [
        'company_id',
        'rule_type',
        'name',
        'pattern',
        'threshold',
        'severity',
        'is_blocking',
        'is_active',
    ];

    public function casts(): array
    {
        return [
            'threshold'   => 'integer',
            'is_blocking' => 'boolean',
            'is_active'   => 'boolean',
        ];
    }
}
