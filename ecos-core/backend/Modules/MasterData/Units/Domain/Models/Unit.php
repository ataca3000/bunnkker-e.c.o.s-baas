<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\MasterData\Units\Infrastructure\Database\Factories\UnitFactory;

/**
 * Unit of measure entity (UUID primary key, soft-deletable).
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property bool $is_active
 */
class Unit extends Model
{
    /** @use HasFactory<UnitFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'name',
        'symbol',
        'description',
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

    protected static function newFactory(): UnitFactory
    {
        return UnitFactory::new();
    }
}
