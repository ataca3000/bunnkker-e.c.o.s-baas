<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string  $id
 * @property string  $branch
 * @property string|null $commit
 * @property string  $mode
 * @property int     $overall_score
 * @property bool    $release_ready
 * @property array   $categories
 * @property array   $metrics
 * @property array   $blockers
 * @property array|null  $report_json
 * @property string|null $report_file
 * @property \Carbon\Carbon $certified_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
final class EngineeringRun extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'engineering_runs';

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'branch',
        'commit',
        'mode',
        'overall_score',
        'release_ready',
        'categories',
        'metrics',
        'blockers',
        'report_json',
        'report_file',
        'certified_at',
    ];

    protected function casts(): array
    {
        return [
            'overall_score'  => 'integer',
            'release_ready'  => 'boolean',
            'categories'     => 'array',
            'metrics'        => 'array',
            'blockers'       => 'array',
            'report_json'    => 'array',
            'certified_at'   => 'datetime',
        ];
    }

    public function findings(): HasMany
    {
        return $this->hasMany(EngineeringFinding::class, 'engineering_run_id');
    }

    public function criticalCount(): int
    {
        return $this->findings()->where('severity', 'CRITICAL')->count();
    }

    public function highCount(): int
    {
        return $this->findings()->where('severity', 'HIGH')->count();
    }
}
