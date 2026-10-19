<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string  $id
 * @property string  $engineering_run_id
 * @property string  $severity
 * @property string  $category
 * @property string|null $file
 * @property int|null    $line
 * @property string  $title
 * @property string|null $description
 * @property string|null $fix_suggestion
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
final class EngineeringFinding extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'engineering_findings';

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'engineering_run_id',
        'severity',
        'category',
        'file',
        'line',
        'title',
        'description',
        'fix_suggestion',
    ];

    protected function casts(): array
    {
        return [
            'line' => 'integer',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(EngineeringRun::class, 'engineering_run_id');
    }
}
