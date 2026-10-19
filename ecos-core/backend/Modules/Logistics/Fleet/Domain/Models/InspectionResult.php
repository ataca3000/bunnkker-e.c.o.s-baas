<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;

/**
 * One item's outcome.
 *
 * item_label and failure_severity are copied from the template item at
 * performance time so a historical result stays readable even if the template
 * item is later renamed or removed.
 */
class InspectionResult extends Model
{
    protected $table = 'fleet_inspection_results';

    /** @var array<string, mixed> */
    protected $attributes = [
        'passed' => true,
        'failure_severity' => DefectSeverity::Major->value,
    ];

    protected $fillable = [
        'inspection_id', 'template_item_id',
        'item_code', 'item_label', 'failure_severity',
        'passed', 'comment', 'photos',
    ];

    protected function casts(): array
    {
        return [
            'failure_severity' => DefectSeverity::class,
            'passed' => 'boolean',
            'photos' => 'array',
        ];
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(Inspection::class, 'inspection_id');
    }

    public function templateItem(): BelongsTo
    {
        return $this->belongsTo(InspectionTemplateItem::class, 'template_item_id');
    }

    public function isCriticalFailure(): bool
    {
        return ! $this->passed && $this->failure_severity->blocksFitness();
    }
}
