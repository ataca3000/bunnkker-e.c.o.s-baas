<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Enums\ExceptionSeverity;
use Modules\Operations\Preparation\Domain\Enums\ExceptionStatus;
use Modules\Operations\Preparation\Domain\Enums\PreparationIssueType;

/**
 * @property string $id
 * @property string $company_id
 * @property string $preparation_wave_id
 * @property string $exception_type
 * @property PreparationIssueType|null $issue_type
 * @property ExceptionSeverity $severity
 * @property string|null $entity_type
 * @property string|null $entity_id
 * @property string $description
 * @property ExceptionStatus $status
 * @property string|null $raised_by
 * @property \Carbon\Carbon|null $raised_at
 * @property \Carbon\Carbon|null $resolved_at
 * @property string|null $resolved_by
 * @property string|null $resolution_notes
 * @property \Carbon\Carbon|null $escalated_at
 * @property string|null $escalated_to
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PreparationException extends Model
{
    use HasUuids;

    protected $table = 'preparation_exceptions';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'preparation_wave_id',
        'exception_type',
        'issue_type',
        'severity',
        'entity_type',
        'entity_id',
        'description',
        'status',
        'raised_by',
        'raised_at',
        'resolved_at',
        'resolved_by',
        'resolution_notes',
        'escalated_at',
        'escalated_to',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'issue_type' => PreparationIssueType::class,
            'severity' => ExceptionSeverity::class,
            'status' => ExceptionStatus::class,
            'raised_at' => 'datetime',
            'resolved_at' => 'datetime',
            'escalated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PreparationWave, $this> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
