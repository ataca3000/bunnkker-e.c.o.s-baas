<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;

/**
 * One check on a checklist.
 *
 * failure_severity lives on the item so the checklist decides the consequence
 * of a failure, rather than the readiness service inferring it. A failed
 * "brake fluid" item is critical; a failed "cabin tidy" item is minor.
 */
class InspectionTemplateItem extends Model
{
    protected $table = 'fleet_inspection_template_items';

    /** @var array<string, mixed> */
    protected $attributes = [
        'display_order' => 0,
        'is_mandatory' => true,
        'requires_photo_on_fail' => false,
        'failure_severity' => DefectSeverity::Major->value,
    ];

    protected $fillable = [
        'template_id', 'code', 'label', 'guidance', 'display_order',
        'is_mandatory', 'requires_photo_on_fail', 'failure_severity',
    ];

    protected function casts(): array
    {
        return [
            'failure_severity' => DefectSeverity::class,
            'display_order' => 'integer',
            'is_mandatory' => 'boolean',
            'requires_photo_on_fail' => 'boolean',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(InspectionTemplate::class, 'template_id');
    }

    public function failureBlocksFitness(): bool
    {
        return $this->failure_severity->blocksFitness();
    }
}
