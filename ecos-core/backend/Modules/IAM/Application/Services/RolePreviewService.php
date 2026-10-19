<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Modules\IAM\Domain\Contracts\RoleTemplateRepositoryInterface;
use Modules\IAM\Domain\Models\RoleTemplate;
use Modules\IAM\Domain\ValueObjects\EffectiveRoleProfile;

/**
 * Computes what a role (or a composition of roles) would grant — navigation, dashboard,
 * permissions, visibility, scopes, policies — WITHOUT assigning anything (ADR-039).
 */
class RolePreviewService
{
    public function __construct(
        private readonly RoleTemplateRepositoryInterface $repository,
        private readonly RoleCompositionService $composition,
    ) {}

    /** Preview a single template (permissions expanded to concrete names). */
    public function preview(RoleTemplate $template): EffectiveRoleProfile
    {
        return $this->composition->composeProfiles([$template->profile()]);
    }

    /**
     * Preview the effective profile a user would receive from one or more template keys,
     * in priority order (first key = primary).
     *
     * @param  list<string>  $keys
     */
    public function previewByKeys(array $keys): EffectiveRoleProfile
    {
        $templates = [];
        foreach ($keys as $key) {
            $template = $this->repository->findByKey($key);
            if ($template !== null) {
                $templates[] = $template;
            }
        }

        return $this->composition->compose($templates);
    }
}
