<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

final class EngineeringFileLock extends Model
{
    use HasFactory;

    protected $table = 'engineering_file_locks';

    protected $keyType = 'integer';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'repository_path',
        'file_path',
        'worker_id',
        'task_id',
        'lock_type',
        'expires_at',
        'acquired_at',
    ];

    protected $casts = [
        'expires_at'  => 'datetime',
        'acquired_at' => 'datetime',
    ];
}
