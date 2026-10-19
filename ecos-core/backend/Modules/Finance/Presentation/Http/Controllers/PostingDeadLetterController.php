<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Integration\Domain\Models\PostingDeadLetter;
use Modules\Finance\Integration\Domain\Services\DeadLetterService;
use Modules\Finance\Integration\Domain\Services\FinancialEventProcessor;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * The dead-letter queue admin — inspect events that could not post, and replay
 * them once the cause (usually an unmapped account role) is fixed. Replay is
 * idempotent, so it can never double-post.
 */
class PostingDeadLetterController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly DeadLetterService $deadLetters,
        private readonly FinancialEventProcessor $processor,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $letters = PostingDeadLetter::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')), fn ($q) => $q->where('status', 'pending'))
            ->latest('id')
            ->limit(200)
            ->get()
            ->map(fn (PostingDeadLetter $l) => $this->payload($l));

        return response()->json(['data' => $letters]);
    }

    public function retry(Request $request, string $uuid): JsonResponse
    {
        $letter = $this->find($request, $uuid);
        $outcome = $this->deadLetters->retry($letter, $this->processor, $this->actorId($request));

        return response()->json(['data' => [
            'outcome' => $outcome->toArray(),
            'dead_letter' => $this->payload($letter->refresh()),
        ]]);
    }

    public function discard(Request $request, string $uuid): JsonResponse
    {
        $letter = $this->deadLetters->discard($this->find($request, $uuid), $this->actorId($request));

        return response()->json(['data' => $this->payload($letter)]);
    }

    private function find(Request $request, string $uuid): PostingDeadLetter
    {
        return PostingDeadLetter::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(PostingDeadLetter $l): array
    {
        return [
            'id' => $l->uuid,
            'module' => $l->source_module,
            'event_code' => $l->event_code,
            'entity_type' => $l->source_entity_type,
            'entity_id' => $l->source_entity_id,
            'error' => $l->error,
            'attempts' => $l->attempts,
            'status' => $l->status,
            'last_attempt_at' => $l->last_attempt_at?->toIso8601String(),
        ];
    }
}
