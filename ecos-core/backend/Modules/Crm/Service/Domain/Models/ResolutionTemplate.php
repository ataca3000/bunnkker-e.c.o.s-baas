<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A reusable resolution from the resolution library. */
class ResolutionTemplate extends Model
{
    use HasUuids;

    protected $table = 'crm_resolution_templates';

    protected $fillable = ['company_id', 'title', 'body', 'category', 'applies_to_type', 'usage_count', 'is_active', 'created_by'];

    protected function casts(): array
    {
        return ['usage_count' => 'integer', 'is_active' => 'boolean'];
    }
}
