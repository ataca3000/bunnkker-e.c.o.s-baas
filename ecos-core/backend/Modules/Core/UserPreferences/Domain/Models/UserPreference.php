<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Domain\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Core\UserPreferences\Infrastructure\Database\Factories\UserPreferenceFactory;

/**
 * Stores the preference payload for one (user, category) pair.
 *
 * @property string $id
 * @property int $user_id
 * @property string $category Preference namespace, e.g. 'products', 'theme'
 * @property array<string, mixed> $payload The preference data for this category
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 */
class UserPreference extends Model
{
    /** @use HasFactory<UserPreferenceFactory> */
    use HasFactory, HasUuids;

    protected $table = 'user_preferences';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'category',
        'payload',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected static function newFactory(): UserPreferenceFactory
    {
        return UserPreferenceFactory::new();
    }
}
