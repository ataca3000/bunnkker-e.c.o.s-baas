<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Loading\Domain\Enums\ExceptionSeverity;
use Modules\Operations\Loading\Domain\Enums\LoadingExceptionStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $loading_session_id
 * @property string|null $vehicle_assignment_id
 * @property string $exception_type
 * @property ExceptionSeverity $severity
 * @property string|null $entity_type
 * @property string|null $entity_id
 * @property string $description
 * @property LoadingExceptionStatus $status
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
class LoadingException extends Model
{
    use HasUuids;

    protected $table = 'loading_exceptions';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'loading_session_id',
        'vehicle_assignment_id',
        'exception_type',
        'severity',
        'entity_type',
        'entity_id',
        'description',
        'status',
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
            'severity' => ExceptionSeverity::class,
            'status' => LoadingExceptionStatus::class,
            'resolved_at' => 'datetime',
            'escalated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<LoadingSession, $this> */
    public function loadingSession(): BelongsTo
    {
        return $this->belongsTo(LoadingSession::class, 'loading_session_id');
    }

    /** @return BelongsTo<VehicleAssignment, $this> */
    public function vehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(VehicleAssignment::class, 'vehicle_assignment_id');
    }
}
