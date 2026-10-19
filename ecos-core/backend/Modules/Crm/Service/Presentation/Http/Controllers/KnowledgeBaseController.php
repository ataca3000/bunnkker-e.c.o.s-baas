<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Service\Domain\Models\KbArticle;
use Modules\Crm\Service\Domain\Services\KnowledgeBaseService;

/** The knowledge base — search, read, author and publish help articles. */
class KnowledgeBaseController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly KnowledgeBaseService $kb) {}

    public function index(Request $request): JsonResponse
    {
        $rows = $this->kb->search(
            $this->companyId($request),
            $request->filled('q') ? (string) $request->string('q') : null,
            $request->filled('category') ? (string) $request->string('category') : null,
            ! $request->boolean('include_drafts'),
        )->map(fn (KbArticle $a) => ['id' => $a->id, 'title' => $a->title, 'slug' => $a->slug, 'category' => $a->category, 'status' => $a->status, 'views' => $a->views]);

        return response()->json(['data' => $rows]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $article = $this->article($request, $id);
        $this->kb->recordView($article);

        return response()->json(['data' => ['id' => $article->id, 'title' => $article->title, 'body' => $article->body, 'category' => $article->category, 'tags' => $article->tags, 'status' => $article->status]]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'title' => ['required', 'string', 'max:250'],
            'body' => ['required', 'string'],
            'category' => ['nullable', 'string', 'max:80'],
            'tags' => ['nullable', 'array'],
        ]);

        $article = $this->kb->create($this->companyId($request), $v, $this->actorId($request));

        return response()->json(['data' => ['id' => $article->id, 'slug' => $article->slug]], 201);
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['status' => $this->kb->publish($this->article($request, $id))->status]]);
    }

    public function archive(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => ['status' => $this->kb->archive($this->article($request, $id))->status]]);
    }

    private function article(Request $request, string $id): KbArticle
    {
        return KbArticle::query()->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }
}
