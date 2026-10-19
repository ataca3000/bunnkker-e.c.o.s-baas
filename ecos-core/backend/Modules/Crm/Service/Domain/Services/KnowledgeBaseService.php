<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Crm\Service\Domain\Models\KbArticle;

/** The knowledge base — authoring, publishing and searching help articles. */
final class KnowledgeBaseService
{
    /** @param array<string, mixed> $data */
    public function create(string $companyId, array $data, ?int $authorId = null): KbArticle
    {
        return KbArticle::create([
            'company_id' => $companyId,
            'title' => $data['title'],
            'slug' => $this->uniqueSlug($companyId, $data['title']),
            'body' => $data['body'],
            'category' => $data['category'] ?? null,
            'tags' => $data['tags'] ?? null,
            'status' => 'draft',
            'author_id' => $authorId,
        ]);
    }

    public function publish(KbArticle $article): KbArticle
    {
        $article->update(['status' => 'published', 'published_at' => Carbon::now()]);

        return $article->refresh();
    }

    public function archive(KbArticle $article): KbArticle
    {
        $article->update(['status' => 'archived']);

        return $article->refresh();
    }

    /** @return \Illuminate\Support\Collection<int, KbArticle> */
    public function search(string $companyId, ?string $term, ?string $category = null, bool $publishedOnly = true)
    {
        return KbArticle::query()
            ->where('company_id', $companyId)
            ->when($publishedOnly, fn ($q) => $q->where('status', 'published'))
            ->when($category !== null, fn ($q) => $q->where('category', $category))
            ->when($term !== null && $term !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('title', 'like', "%{$term}%")
                ->orWhere('body', 'like', "%{$term}%")))
            ->orderByDesc('views')
            ->limit(50)
            ->get();
    }

    public function recordView(KbArticle $article): void
    {
        $article->increment('views');
    }

    private function uniqueSlug(string $companyId, string $title): string
    {
        $base = Str::slug($title) ?: 'article';
        $slug = $base;
        $n = 1;
        while (KbArticle::where('company_id', $companyId)->where('slug', $slug)->exists()) {
            $slug = $base.'-'.(++$n);
        }

        return $slug;
    }
}
