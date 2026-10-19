<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Model;

class ValidationHistory extends Model
{
    protected $table = 'engineering_validation_history';

    public $timestamps = false;

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'validation_id',
        'patch_id',
        'company_id',
        'event_type',
        'event_data',
        'actor_id',
        'occurred_at',
    ];

    public function casts(): array
    {
        return [
            'event_data'  => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
