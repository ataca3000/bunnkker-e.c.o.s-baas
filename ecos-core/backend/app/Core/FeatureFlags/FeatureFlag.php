<?php

declare(strict_types=1);

namespace App\Core\FeatureFlags;

use Illuminate\Database\Eloquent\Model;

final class FeatureFlag extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'feature_flags';

    protected $fillable = [
        'id',
        'company_id',
        'key',
        'enabled',
        'description',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'metadata' => 'array',
        ];
    }
}
