<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Preparation\Domain\Enums\PickListStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $preparation_wave_id
 * @property PickListStatus $status
 * @property \Carbon\Carbon $generated_at
 * @property string $generated_by
 * @property \Carbon\Carbon|null $started_at
 * @property \Carbon\Carbon|null $completed_at
 * @property string|null $picker_id
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PreparationPickList extends Model
{
    use HasUuids;

    protected $table = 'preparation_pick_lists';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'preparation_wave_id',
        'status',
        'generated_at',
        'generated_by',
        'started_at',
        'completed_at',
        'picker_id',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => PickListStatus::class,
            'generated_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PreparationWave, $this> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }

    /** @return HasMany<PreparationPickListItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(PreparationPickListItem::class, 'pick_list_id');
    }
}
