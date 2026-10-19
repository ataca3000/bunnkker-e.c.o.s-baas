<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuardianReport extends Model
{
    use HasUuids;

    protected $table = 'engineering_guardian_reports';

    public $timestamps = false;

    protected $fillable = [
        'run_id',
        'company_id',
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

    public function run(): BelongsTo
    {
        return $this->belongsTo(GuardianRun::class, 'run_id');
    }
}
