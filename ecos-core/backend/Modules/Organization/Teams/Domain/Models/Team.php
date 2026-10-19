<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Organization\Teams\Infrastructure\Database\Factories\TeamFactory;

/**
 * Team aggregate root.
 * Represents an operational team within a company.
 *
 * @property string $id
 * @property string $company_id
 * @property string $code
 * @property string $name
 * @property string|null $leader_name
 * @property string|null $description
 * @property bool $is_active
 */
class Team extends Model
{
    /** @use HasFactory<TeamFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'code',
        'name',
        'leader_name',
        'description',
        'is_active',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    protected static function newFactory(): TeamFactory
    {
        return TeamFactory::new();
    }
}
