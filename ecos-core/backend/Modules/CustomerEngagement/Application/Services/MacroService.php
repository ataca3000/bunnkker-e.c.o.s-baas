<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\CustomerEngagement\Domain\Models\ConversationMacro;

class MacroService
{
    public function paginate(array $filters, int $perPage = 25): LengthAwarePaginator
    {
        return ConversationMacro::query()
            ->when(! empty($filters['company_id']), fn ($q) => $q->where('company_id', $filters['company_id']))
            ->when(! empty($filters['category']), fn ($q) => $q->where('category', $filters['category']))
            ->when(! empty($filters['search']), fn ($q) => $q->where(function ($sq) use ($filters) {
                $sq->where('name', 'ilike', "%{$filters['search']}%")
                    ->orWhere('shortcut', 'ilike', "%{$filters['search']}%");
            }))
            ->orderBy('usage_count', 'desc')
            ->paginate($perPage);
    }

    public function create(array $data): ConversationMacro
    {
        return ConversationMacro::create($data);
    }

    public function update(ConversationMacro $macro, array $data): ConversationMacro
    {
        $macro->update($data);

        return $macro->fresh();
    }

    public function delete(ConversationMacro $macro): void
    {
        $macro->delete();
    }

    public function findByShortcut(string $shortcut, string $companyId): ?ConversationMacro
    {
        return ConversationMacro::where('shortcut', $shortcut)->where('company_id', $companyId)->first();
    }

    public function apply(ConversationMacro $macro, array $context = []): string
    {
        $macro->incrementUsage();

        return $macro->resolveContent($context);
    }
}
