<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Application\Actions;

use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiative;
use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiativeTemplate;

/**
 * Create a Marketing Initiative pre-populated from a Template.
 *
 * Template defaults fill all fields the caller doesn't override.
 * The template's usage_count is incremented.
 */
final class CreateInitiativeFromTemplateAction
{
    /**
     * @param  array<string, mixed>  $overrides  Caller-supplied field values that win over template defaults
     */
    public function execute(
        MarketingInitiativeTemplate $template,
        array $overrides = [],
        ?string $actorId = null,
    ): MarketingInitiative {
        $defaults = $template->defaults ?? [];

        $data = array_merge($defaults, $overrides);

        $initiative = MarketingInitiative::create([
            'template_id' => $template->id,
            'name' => $data['name'] ?? $template->name,
            'description' => $data['description'] ?? $template->description,
            'status' => 'draft',
            'business_goal' => $data['business_goal'] ?? null,
            'season' => $data['season'] ?? null,
            'business_unit' => $data['business_unit'] ?? null,
            'cost_center' => $data['cost_center'] ?? null,
            'marketing_team' => $data['marketing_team'] ?? null,
            'company_id' => $data['company_id'] ?? null,
            'brand_id' => $data['brand_id'] ?? null,
            'channel_id' => $data['channel_id'] ?? null,
            'currency' => $data['currency'] ?? 'EGP',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        $template->increment('usage_count');

        return $initiative;
    }
}
