<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A knowledge-base article. */
class KbArticle extends Model
{
    use HasUuids;

    protected $table = 'crm_kb_articles';

    protected $fillable = ['company_id', 'title', 'slug', 'body', 'category', 'tags', 'status', 'views', 'author_id', 'published_at'];

    protected function casts(): array
    {
        return ['tags' => 'array', 'views' => 'integer', 'published_at' => 'datetime'];
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
