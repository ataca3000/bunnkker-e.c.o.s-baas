<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Core\BusinessAttribution\Domain\Enums\AttributionModel;

/**
 * Company-level attribution model configuration.
 *
 * @property string $id
 * @property string $company_id
 * @property AttributionModel $model
 * @property array|null $config
 * @property bool $is_default
 * @property string|null $created_by
 * @property string|null $updated_by
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class AttributionConfig extends Model
{
    use HasUuids;

    protected $table = 'bae_attribution_configs';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'model' => AttributionModel::class,
            'config' => 'array',
            'is_default' => 'boolean',
        ];
    }
}
