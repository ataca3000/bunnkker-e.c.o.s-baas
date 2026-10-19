<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\Event;
use Modules\System\Engineering\Domain\Enums\AgentStatus;
use Modules\System\Engineering\Domain\Events\Agent\AgentHeartbeatReceived;
use Modules\System\Engineering\Domain\Models\EngineeringAgent;
use Modules\System\Engineering\Domain\Models\EngineeringAgentHeartbeat;

class AgentHeartbeatService
{
    private const HEARTBEAT_RETENTION_HOURS = 24;
    private const HEARTBEAT_MAX_COUNT       = 1000;

    public function record(EngineeringAgent $agent, array $data): EngineeringAgentHeartbeat
    {
        $previousStatus = $agent->status;

        $heartbeat                  = new EngineeringAgentHeartbeat();
        $heartbeat->agent_id        = $agent->id;
        $heartbeat->status          = $data['status'];
        $heartbeat->cpu_percent     = $data['cpu_percent'] ?? null;
        $heartbeat->memory_mb_used  = $data['memory_mb_used'] ?? null;
        $heartbeat->disk_free_gb    = $data['disk_free_gb'] ?? null;
        $heartbeat->load_average    = $data['load_average'] ?? null;
        $heartbeat->current_task_id = $data['current_task_id'] ?? null;
        $heartbeat->recorded_at     = now();
        $heartbeat->save();

        $newStatus     = $data['status'];
        $agent->status       = $newStatus;
        $agent->last_seen_at = now();
        $agent->save();

        if ($previousStatus !== $newStatus) {
            Event::dispatch(new AgentHeartbeatReceived($agent, $heartbeat, $previousStatus));
        }

        $this->pruneOldHeartbeats($agent);

        return $heartbeat;
    }

    public function getLatest(EngineeringAgent $agent): ?EngineeringAgentHeartbeat
    {
        return EngineeringAgentHeartbeat::where('agent_id', $agent->id)
            ->orderByDesc('recorded_at')
            ->first();
    }

    public function isAgentStale(EngineeringAgent $agent, int $thresholdMinutes = 5): bool
    {
        if ($agent->last_seen_at === null) {
            return true;
        }

        return $agent->last_seen_at->diffInMinutes(now()) > $thresholdMinutes;
    }

    private function pruneOldHeartbeats(EngineeringAgent $agent): void
    {
        $cutoff = now()->subHours(self::HEARTBEAT_RETENTION_HOURS);

        EngineeringAgentHeartbeat::where('agent_id', $agent->id)
            ->where('recorded_at', '<', $cutoff)
            ->delete();

        $totalRemaining = EngineeringAgentHeartbeat::where('agent_id', $agent->id)->count();

        if ($totalRemaining > self::HEARTBEAT_MAX_COUNT) {
            $excess = $totalRemaining - self::HEARTBEAT_MAX_COUNT;

            $oldestIds = EngineeringAgentHeartbeat::where('agent_id', $agent->id)
                ->orderBy('recorded_at')
                ->limit($excess)
                ->pluck('id');

            EngineeringAgentHeartbeat::whereIn('id', $oldestIds)->delete();
        }
    }
}
