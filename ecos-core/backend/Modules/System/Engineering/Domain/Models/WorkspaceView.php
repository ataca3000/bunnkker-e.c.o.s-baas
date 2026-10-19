<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WorkspaceView extends Model
{
    use HasUuids;

    protected $table = 'engineering_workspace_views';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'user_id',
        'name',
        'context',
        'filters',
        'is_shared',
    ];

    protected function casts(): array
    {
        return [
            'filters'   => 'array',
            'is_shared' => 'boolean',
        ];
    }
}
