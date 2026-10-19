<?php

declare(strict_types=1);

namespace Modules\Finance\Controls\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Modules\Finance\Controls\Domain\Enums\ControlSeverity;

/**
 * A financial control finding — the register the report-only control checks write
 * to. Controls never modify ledger, budget or VAT data; they open exceptions
 * here, which a controller then acknowledges or resolves.
 */
class ControlException extends Model
{
    protected $table = 'finance_control_exceptions';

    /** @var array<string, mixed> */
    protected $attributes = ['severity' => 'warning', 'category' => 'general', 'status' => 'open'];

    protected $fillable = [
        'uuid', 'company_id', 'fiscal_period_id', 'check_key', 'category', 'severity',
        'entity_type', 'entity_id', 'message', 'status', 'detected_at', 'resolved_by', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'severity' => ControlSeverity::class,
            'detected_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $row): void {
            if ($row->uuid === null) {
                $row->uuid = (string) Str::uuid();
            }
            if ($row->detected_at === null) {
                $row->detected_at = now();
            }
        });
    }

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }
}
