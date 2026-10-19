<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string|null $company_id
 * @property string|null $connection_id
 * @property string $type csv|excel|pdf|html
 * @property string $status pending|completed|failed
 * @property string $report_name
 * @property array $filters
 * @property string|null $file_path
 * @property string|null $error_message
 * @property int|null $row_count
 * @property string|null $generated_by
 * @property \Carbon\Carbon|null $generated_at
 * @property \Carbon\Carbon|null $expires_at
 * @property \Carbon\Carbon $created_at
 */
final class MarketingReport extends Model
{
    use HasUuids;

    protected $table = 'marketing_reports';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'filters' => 'array',
            'generated_at' => 'datetime',
            'expires_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function markCompleted(string $filePath, int $rowCount): void
    {
        $this->update([
            'status' => 'completed',
            'file_path' => $filePath,
            'row_count' => $rowCount,
            'generated_at' => now(),
            'expires_at' => now()->addHours(24),
        ]);
    }

    public function markFailed(string $errorMessage): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $errorMessage,
            'generated_at' => now(),
        ]);
    }
}
