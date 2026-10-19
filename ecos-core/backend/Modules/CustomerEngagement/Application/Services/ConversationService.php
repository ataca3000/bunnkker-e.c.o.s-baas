<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Modules\CustomerEngagement\Domain\Enums\ConversationPriority;
use Modules\CustomerEngagement\Domain\Enums\ConversationStatus;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class ConversationService
{
    public function create(array $data): Conversation
    {
        return Conversation::create(array_merge($data, [
            'conversation_uuid' => Str::uuid()->toString(),
            'started_at' => now(),
            'status' => ConversationStatus::Open->value,
            'priority' => $data['priority'] ?? ConversationPriority::Medium->value,
            'tags' => $data['tags'] ?? [],
        ]));
    }

    public function updateStatus(Conversation $conv, ConversationStatus $status): Conversation
    {
        $data = ['status' => $status->value];

        if ($status->isTerminal()) {
            $data['closed_at'] = now();
        }

        $conv->update($data);

        return $conv->fresh();
    }

    public function close(Conversation $conv): Conversation
    {
        return $this->updateStatus($conv, ConversationStatus::Closed);
    }

    public function resolve(Conversation $conv): Conversation
    {
        return $this->updateStatus($conv, ConversationStatus::Resolved);
    }

    public function reopen(Conversation $conv): Conversation
    {
        $conv->update(['status' => ConversationStatus::Open->value, 'closed_at' => null]);

        return $conv->fresh();
    }

    public function updatePriority(Conversation $conv, ConversationPriority $priority): Conversation
    {
        $conv->update(['priority' => $priority->value]);

        return $conv->fresh();
    }

    public function addTag(Conversation $conv, string $tag): void
    {
        $tags = $conv->tags ?? [];
        if (! in_array($tag, $tags)) {
            $tags[] = $tag;
            $conv->update(['tags' => $tags]);
        }
    }

    public function removeTag(Conversation $conv, string $tag): void
    {
        $tags = array_values(array_filter($conv->tags ?? [], fn ($t) => $t !== $tag));
        $conv->update(['tags' => $tags]);
    }

    public function markFirstResponse(Conversation $conv): void
    {
        if (is_null($conv->first_response_at)) {
            $conv->update(['first_response_at' => now()]);
        }
    }

    public function incrementUnread(Conversation $conv): void
    {
        $conv->increment('unread_count');
        $conv->update(['last_message_at' => now()]);
    }

    public function clearUnread(Conversation $conv): void
    {
        $conv->update(['unread_count' => 0]);
    }

    public function search(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        $q = Conversation::query()->latest('last_message_at');

        if (! empty($filters['company_id'])) {
            $q->where('company_id', $filters['company_id']);
        }
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['provider'])) {
            $q->where('provider', $filters['provider']);
        }
        if (! empty($filters['priority'])) {
            $q->where('priority', $filters['priority']);
        }
        if (! empty($filters['assigned_employee_id'])) {
            $q->where('assigned_employee_id', $filters['assigned_employee_id']);
        }
        if (! empty($filters['assigned_team_id'])) {
            $q->where('assigned_team_id', $filters['assigned_team_id']);
        }
        if (! empty($filters['unread_only'])) {
            $q->where('unread_count', '>', 0);
        }
        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $q->where(function ($sq) use ($term) {
                $sq->where('customer_name', 'like', "%{$term}%")
                    ->orWhere('customer_phone', 'like', "%{$term}%")
                    ->orWhere('customer_email', 'like', "%{$term}%");
            });
        }

        return $q->paginate($perPage);
    }

    public function find(string $id): Conversation
    {
        return Conversation::findOrFail($id);
    }
}
