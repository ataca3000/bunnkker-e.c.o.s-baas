<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Illuminate\Support\Collection;
use Modules\CustomerEngagement\Domain\Enums\SlaViolationType;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\SlaPolicy;
use Modules\CustomerEngagement\Domain\Models\SlaViolation;

class SlaService
{
    public function startTracking(Conversation $conv): void
    {
        $policy = $this->resolvePolicy($conv);
        if (! $policy) {
            return;
        }

        $startedAt = $conv->started_at ?? now();

        SlaViolation::create([
            'conversation_id' => $conv->id,
            'sla_policy_id' => $policy->id,
            'violation_type' => SlaViolationType::FirstResponse->value,
            'status' => 'pending',
            'due_at' => $startedAt->addMinutes($policy->first_response_minutes),
        ]);

        SlaViolation::create([
            'conversation_id' => $conv->id,
            'sla_policy_id' => $policy->id,
            'violation_type' => SlaViolationType::Resolution->value,
            'status' => 'pending',
            'due_at' => $startedAt->addMinutes($policy->resolution_minutes),
        ]);
    }

    public function recordFirstResponse(Conversation $conv): void
    {
        SlaViolation::where('conversation_id', $conv->id)
            ->where('violation_type', SlaViolationType::FirstResponse->value)
            ->where('status', 'pending')
            ->update(['status' => 'resolved', 'resolved_at' => now()]);
    }

    public function recordResolution(Conversation $conv): void
    {
        SlaViolation::where('conversation_id', $conv->id)
            ->where('violation_type', SlaViolationType::Resolution->value)
            ->where('status', 'pending')
            ->update(['status' => 'resolved', 'resolved_at' => now()]);
    }

    public function checkAndMarkBreaches(): int
    {
        $count = SlaViolation::where('status', 'pending')
            ->where('due_at', '<', now())
            ->update(['status' => 'breached', 'breached_at' => now()]);

        return $count;
    }

    public function getViolationsForConversation(string $conversationId): Collection
    {
        return SlaViolation::where('conversation_id', $conversationId)->get();
    }

    public function getComplianceStats(?string $companyId = null): array
    {
        $q = SlaViolation::query();
        if ($companyId) {
            $q->whereHas('conversation', fn ($c) => $c->where('company_id', $companyId));
        }

        $total = (clone $q)->count();
        $breached = (clone $q)->where('status', 'breached')->count();
        $resolved = (clone $q)->where('status', 'resolved')->count();
        $pending = (clone $q)->where('status', 'pending')->count();
        $rate = $total > 0 ? round((($resolved) / $total) * 100, 1) : 100.0;

        return compact('total', 'breached', 'resolved', 'pending', 'rate');
    }

    public function getDefaultPolicy(?string $companyId = null): ?SlaPolicy
    {
        return SlaPolicy::where('is_default', true)
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->first();
    }

    public function listPolicies(?string $companyId = null): Collection
    {
        return SlaPolicy::when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->orderByDesc('is_default')
            ->get();
    }

    public function createPolicy(array $data): SlaPolicy
    {
        if (! empty($data['is_default']) && $data['is_default']) {
            SlaPolicy::where('company_id', $data['company_id'] ?? null)
                ->update(['is_default' => false]);
        }

        return SlaPolicy::create($data);
    }

    private function resolvePolicy(Conversation $conv): ?SlaPolicy
    {
        if ($conv->sla_policy_id) {
            return SlaPolicy::find($conv->sla_policy_id);
        }

        return $this->getDefaultPolicy($conv->company_id);
    }
}
