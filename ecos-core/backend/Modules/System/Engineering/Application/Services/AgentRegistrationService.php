<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Modules\System\Engineering\Domain\Enums\AgentStatus;
use Modules\System\Engineering\Domain\Events\Agent\AgentRegistered;
use Modules\System\Engineering\Domain\Models\EngineeringAgent;
use Modules\System\Engineering\Domain\Models\EngineeringAgentCapability;

class AgentRegistrationService
{
    public function register(string $companyId, array $data): array
    {
        $rawKey = Str::random(64);

        $agent = DB::transaction(function () use ($companyId, $data, $rawKey): EngineeringAgent {
            $existing = $this->findByFingerprint($companyId, $data['machine_fingerprint']);

            if ($existing !== null) {
                $agent = $existing;
            } else {
                $agent = new EngineeringAgent();
                $agent->company_id         = $companyId;
                $agent->machine_fingerprint = $data['machine_fingerprint'];
            }

            $agent->name           = $data['name'];
            $agent->agent_type     = $data['agent_type'];
            $agent->os_info        = $data['os_info'] ?? null;
            $agent->ip_address     = $data['ip_address'] ?? null;
            $agent->version        = $data['version'] ?? null;
            $agent->platform_info  = isset($data['platform_info']) ? $data['platform_info'] : null;
            $agent->api_key_hash   = bcrypt($rawKey);
            $agent->status         = AgentStatus::Idle;
            $agent->registered_at  = now();
            $agent->save();

            $capabilities = $data['capabilities'] ?? [];

            if (!empty($capabilities)) {
                foreach ($capabilities as $capability) {
                    EngineeringAgentCapability::updateOrCreate(
                        [
                            'agent_id' => $agent->id,
                            'key'      => $capability['key'],
                        ],
                        [
                            'version'     => $capability['version'] ?? null,
                            'proficiency' => $capability['proficiency'] ?? null,
                        ]
                    );
                }

                $currentKeys = array_column($capabilities, 'key');
                EngineeringAgentCapability::where('agent_id', $agent->id)
                    ->whereNotIn('key', $currentKeys)
                    ->delete();
            }

            Event::dispatch(new AgentRegistered($agent));

            return $agent;
        });

        return [
            'agent'   => $agent,
            'api_key' => $rawKey,
        ];
    }

    public function deregister(EngineeringAgent $agent): void
    {
        $agent->status          = AgentStatus::Terminated;
        $agent->deregistered_at = now();
        $agent->save();
    }

    public function validateApiKey(EngineeringAgent $agent, string $providedKey): bool
    {
        return password_verify($providedKey, $agent->api_key_hash);
    }

    public function findByFingerprint(string $companyId, string $fingerprint): ?EngineeringAgent
    {
        return EngineeringAgent::where('company_id', $companyId)
            ->where('machine_fingerprint', $fingerprint)
            ->first();
    }
}
