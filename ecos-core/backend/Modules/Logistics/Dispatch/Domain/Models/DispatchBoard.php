<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchBoardStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ProposalStatus;
use Modules\Logistics\Network\Domain\Models\DispatchRegion;

/** One board per (origin, date) — the unit of a dispatcher's working day. */
class DispatchBoard extends Model
{
    protected $table = 'dispatch_boards';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => DispatchBoardStatus::Open->value,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'dispatch_region_id', 'warehouse_id',
        'board_date', 'status', 'status_reason',
        'planned_at', 'released_at', 'closed_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => DispatchBoardStatus::class,
            'board_date' => 'date:Y-m-d',
            'planned_at' => 'datetime',
            'released_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $board): void {
            if ($board->uuid === null) {
                $board->uuid = (string) Str::uuid();
            }
        });
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(DispatchRegion::class, 'dispatch_region_id');
    }

    public function proposals(): HasMany
    {
        return $this->hasMany(DispatchProposal::class, 'dispatch_board_id')->latest('id');
    }

    /** The proposal currently under consideration, if any. */
    public function currentProposal(): ?DispatchProposal
    {
        return $this->proposals()
            ->whereIn('status', [
                ProposalStatus::Generated->value,
                ProposalStatus::Accepted->value,
            ])
            ->first();
    }

    public function isOpen(): bool
    {
        return $this->status->isOpen();
    }
}
