<?php

declare(strict_types=1);

namespace Modules\IAM\Presentation\Concerns;

use Illuminate\Http\Request;
use Modules\IAM\Domain\Contracts\VisibilityResolverInterface;

/**
 * HidesSensitiveFields — server-side field masking for API Resources
 * (TASK-IAM-002 / ADR-038, Part 8).
 *
 * Server-side masking is MANDATORY: a JsonResource that exposes sensitive fields
 * calls maskSensitive() so those keys are removed before serialisation for users who
 * lack the field's permission. Never rely on the frontend to hide data.
 *
 * Opt-in per resource: a resource declares its `visibilityResource()` key and wraps
 * its payload once. Resources that don't use the trait are unchanged (backward compatible).
 *
 * Usage:
 *   use HidesSensitiveFields;
 *   protected function visibilityResource(): string { return 'inventory.products'; }
 *   public function toArray($request): array { return $this->maskSensitive([...], $request); }
 */
trait HidesSensitiveFields
{
    /**
     * The registry key this resource's sensitive-field map was registered under,
     * e.g. "inventory.products".
     */
    abstract protected function visibilityResource(): string;

    /**
     * Remove fields the authenticated user may not see.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function maskSensitive(array $data, Request $request): array
    {
        $user = $request->user();

        if ($user === null) {
            return $data;
        }

        $hidden = app(VisibilityResolverInterface::class)->hiddenFields($user, $this->visibilityResource());

        foreach ($hidden as $field) {
            unset($data[$field]);
        }

        return $data;
    }
}
