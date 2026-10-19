<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Database\Eloquent\Collection;
use Modules\System\Engineering\Domain\Models\GuardianPolicy;

/**
 * TASK-ENG-V2-003 — Autonomous Engineering Guardian.
 *
 * Manages per-company Guardian policies. When a company has no active
 * policy, resolution falls back to a VIRTUAL built-in default built from
 * config('engineering.guardian.default_policy') — the fallback instance
 * is never persisted, so deactivating every stored policy can never
 * disable the Guardian itself.
 */
class GuardianPolicyService
{
    /**
     * Resolve the effective policy for a company.
     *
     * Prefers the active default policy; falls back to any active policy;
     * finally falls back to an UNSAVED instance built from config.
     */
    public function resolveFor(string $companyId): GuardianPolicy
    {
        $policy = GuardianPolicy::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->first();

        if ($policy !== null) {
            return $policy;
        }

        // Built-in default is virtual: build, never save.
        $defaults = (array) config('engineering.guardian.default_policy', []);

        return new GuardianPolicy([
            'company_id'           => $companyId,
            'name'                 => $defaults['name'] ?? 'Built-in Default',
            'description'          => $defaults['description'] ?? 'Virtual built-in Guardian policy (not persisted).',
            'is_active'            => true,
            'is_default'           => true,
            'auto_repair'          => (bool) ($defaults['auto_repair'] ?? true),
            'block_on'             => $defaults['block_on'] ?? null,
            'enabled_checks'       => $defaults['enabled_checks'] ?? null,
            'max_repair_attempts'  => (int) ($defaults['max_repair_attempts'] ?? 2),
            'require_revalidation' => (bool) ($defaults['require_revalidation'] ?? true),
        ]);
    }

    public function create(string $companyId, array $data): GuardianPolicy
    {
        if (! empty($data['is_default'])) {
            $this->clearDefaultFlag($companyId);
        }

        return GuardianPolicy::create([
            'company_id'           => $companyId,
            'name'                 => $data['name'],
            'description'          => $data['description'] ?? null,
            'is_active'            => $data['is_active'] ?? true,
            'is_default'           => $data['is_default'] ?? false,
            'auto_repair'          => $data['auto_repair'] ?? true,
            'block_on'             => $data['block_on'] ?? null,
            'enabled_checks'       => $data['enabled_checks'] ?? null,
            'max_repair_attempts'  => $data['max_repair_attempts'] ?? 2,
            'require_revalidation' => $data['require_revalidation'] ?? true,
        ]);
    }

    public function update(GuardianPolicy $policy, array $data): GuardianPolicy
    {
        if (! empty($data['is_default'])) {
            $this->clearDefaultFlag($policy->company_id, $policy->id);
        }

        $policy->update($data);

        return $policy->fresh();
    }

    public function activate(GuardianPolicy $policy): GuardianPolicy
    {
        $policy->update(['is_active' => true]);

        return $policy->fresh();
    }

    /**
     * Deactivate a policy. Deactivating ALL policies of a company simply
     * makes resolveFor() fall back to the built-in config default — it
     * never disables the Guardian itself.
     */
    public function deactivate(GuardianPolicy $policy): GuardianPolicy
    {
        $policy->update(['is_active' => false]);

        return $policy->fresh();
    }

    /**
     * @return Collection<int, GuardianPolicy>
     */
    public function list(string $companyId): Collection
    {
        return GuardianPolicy::query()
            ->where('company_id', $companyId)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();
    }

    /**
     * Only one policy per company may be flagged as default.
     */
    private function clearDefaultFlag(string $companyId, ?string $exceptId = null): void
    {
        GuardianPolicy::query()
            ->where('company_id', $companyId)
            ->where('is_default', true)
            ->when($exceptId !== null, static fn ($query) => $query->where('id', '!=', $exceptId))
            ->update(['is_default' => false]);
    }
}
