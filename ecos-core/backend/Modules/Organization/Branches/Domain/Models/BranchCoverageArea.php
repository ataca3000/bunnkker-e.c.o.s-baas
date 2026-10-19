<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Admin\Configuration\Domain\Models\MasterGovernorate;
use Modules\Admin\Configuration\Domain\Models\MasterZone;

/**
 * TASK-BRANCH-ASSIGNMENT-ENGINE-001 — Branch coverage area record.
 *
 * Defines which governorate (and optionally which zone within it) a branch is
 * responsible for serving.  When master_zone_id is null the branch covers the
 * entire governorate.
 *
 * @property string      $id
 * @property string      $branch_id
 * @property string      $master_governorate_id
 * @property string|null $master_zone_id
 * @property int         $priority
 * @property bool        $is_active
 */
class BranchCoverageArea extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'master_governorate_id',
        'master_zone_id',
        'priority',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'priority'  => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * @return BelongsTo<MasterGovernorate, $this>
     */
    public function governorate(): BelongsTo
    {
        return $this->belongsTo(MasterGovernorate::class, 'master_governorate_id');
    }

    /**
     * @return BelongsTo<MasterZone, $this>
     */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(MasterZone::class, 'master_zone_id');
    }

    /** Zone-level coverage (more specific) scores higher than governorate-wide. */
    public function specificity(): int
    {
        return $this->master_zone_id !== null ? 2 : 1;
    }
}
