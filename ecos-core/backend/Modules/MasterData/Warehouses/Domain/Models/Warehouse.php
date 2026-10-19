<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Auth;
use Modules\MasterData\Warehouses\Infrastructure\Database\Factories\WarehouseFactory;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Warehouse entity (UUID primary key, soft-deletable) belonging to a company.
 *
 * @property string $id
 * @property string $company_id
 * @property string $code
 * @property string $name
 * @property bool $is_active
 */
class Warehouse extends Model
{
    /** @use HasFactory<WarehouseFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'company_id',
        'code',
        'name',
        'address',
        'city',
        'country',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope('tenant', static function (Builder $query): void {
            if (! Auth::check()) {
                return;
            }
            $companyId = Auth::user()?->company_id;
            if ($companyId === null) {
                return; // super-admin sees all warehouses
            }
            $query->where('company_id', $companyId);
        });
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    protected static function newFactory(): WarehouseFactory
    {
        return WarehouseFactory::new();
    }
}
