<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class GuardianPolicy extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'engineering_guardian_policies';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'name',
        'description',
        'is_active',
        'is_default',
        'auto_repair',
        'block_on',
        'enabled_checks',
        'max_repair_attempts',
        'require_revalidation',
    ];

    protected function casts(): array
    {
        return [
            'is_active'            => 'boolean',
            'is_default'           => 'boolean',
            'auto_repair'          => 'boolean',
            'require_revalidation' => 'boolean',
            'block_on'             => 'array',
            'enabled_checks'       => 'array',
            'max_repair_attempts'  => 'integer',
        ];
    }

    // Methods

    public function blocksCategory(string $category): bool
    {
        $blockOn = $this->block_on;

        return $blockOn === null || in_array($category, $blockOn, true);
    }
}
