<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Modules\Hr\Workforce\Domain\Enums\EmployeeDocumentType;

/** A file attached to an employee, with an optional expiry to watch. */
class EmployeeDocument extends Model
{
    use HasUuids;

    protected $table = 'hr_employee_documents';

    protected $fillable = [
        'company_id', 'employee_id', 'type', 'title',
        'file_path', 'file_name', 'mime_type', 'file_size',
        'issued_at', 'expires_at', 'reference', 'notes', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => EmployeeDocumentType::class,
            'issued_at' => 'date',
            'expires_at' => 'date',
            'file_size' => 'integer',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function isExpired(?Carbon $asOf = null): bool
    {
        if ($this->expires_at === null) {
            return false;
        }

        return $this->expires_at->lessThan(($asOf ?? Carbon::now())->startOfDay());
    }

    public function daysUntilExpiry(?Carbon $asOf = null): ?int
    {
        if ($this->expires_at === null) {
            return null;
        }

        $from = ($asOf ?? Carbon::now())->startOfDay();

        return (int) round($from->diffInDays($this->expires_at->copy()->startOfDay(), false));
    }
}
