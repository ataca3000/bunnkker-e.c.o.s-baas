<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\CustomerEngagement\Domain\Enums\MacroCategory;

class ConversationMacro extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'cep_macros';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'category' => MacroCategory::class,
            'variables' => 'array',
            'applies_to_channels' => 'array',
            'is_shared' => 'boolean',
        ];
    }

    public function resolveContent(array $context = []): string
    {
        $content = $this->content;
        foreach ($context as $key => $value) {
            $content = str_replace('{'.$key.'}', $value, $content);
        }

        return $content;
    }

    public function incrementUsage(): void
    {
        $this->increment('usage_count');
    }
}
