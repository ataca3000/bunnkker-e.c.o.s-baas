<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

final class EngineeringWorkerRuntime extends Model
{
    use HasFactory;

    protected $table = 'engineering_worker_runtime';

    protected $keyType = 'integer';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'worker_id',
        'session_id',
        'metric_key',
        'metric_value',
        'metric_unit',
        'recorded_at',
    ];

    protected $casts = [
        'metric_value' => 'float',
        'recorded_at'  => 'datetime',
    ];
}
