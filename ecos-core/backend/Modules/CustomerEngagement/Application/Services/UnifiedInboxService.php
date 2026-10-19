<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class UnifiedInboxService
{
    public function __construct(
        private readonly ConversationService $conversationService,
    ) {}

    public function getInbox(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return $this->conversationService->search($filters, $perPage);
    }

    public function getUnreadCount(?string $companyId = null): int
    {
        $q = Conversation::where('unread_count', '>', 0)
            ->whereNotIn('status', ['resolved', 'closed']);
        if ($companyId) {
            $q->where('company_id', $companyId);
        }

        return $q->count();
    }

    public function getOpenCount(?string $companyId = null): int
    {
        $q = Conversation::where('status', 'open');
        if ($companyId) {
            $q->where('company_id', $companyId);
        }

        return $q->count();
    }

    public function getStats(?string $companyId = null): array
    {
        $base = Conversation::query();
        if ($companyId) {
            $base->where('company_id', $companyId);
        }

        $total = (clone $base)->count();
        $open = (clone $base)->where('status', 'open')->count();
        $pending = (clone $base)->where('status', 'pending')->count();
        $resolved = (clone $base)->where('status', 'resolved')->count();
        $unread = (clone $base)->where('unread_count', '>', 0)->count();
        $resolvedToday = (clone $base)->where('status', 'resolved')
            ->whereDate('closed_at', today())
            ->count();

        $avgFirstResponse = (clone $base)->whereNotNull('first_response_at')
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (first_response_at - started_at))) as avg_s')
            ->value('avg_s');

        return compact('total', 'open', 'pending', 'resolved', 'unread', 'resolvedToday', 'avgFirstResponse');
    }

    public function getProviderDistribution(?string $companyId = null): array
    {
        $q = Conversation::query()
            ->select('provider', DB::raw('COUNT(*) as count'))
            ->groupBy('provider')
            ->orderByDesc('count');

        if ($companyId) {
            $q->where('company_id', $companyId);
        }

        return $q->get()->toArray();
    }
}
