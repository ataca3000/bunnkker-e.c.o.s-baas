<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $company_id
 * @property string $setting_group
 * @property string $setting_key
 * @property mixed $setting_value
 * @property string|null $description
 * @property int $version
 */
class ConfigCompanySetting extends Model
{
    use HasUuids;

    protected $table = 'config_company_settings';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'setting_group',
        'setting_key',
        'setting_value',
        'description',
        'version',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'setting_value' => 'array',
            'version' => 'integer',
        ];
    }
}
