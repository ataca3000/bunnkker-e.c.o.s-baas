<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Modules\Marketing\CampaignStudio\Domain\Enums\ValidationSeverity;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignValidationResult;
use Modules\Marketing\CampaignStudio\Domain\Models\GovernancePolicy;

class ValidationEngineService
{
    public function validate(CampaignDraft $draft): array
    {
        $draft->loadMissing(['audience', 'creatives', 'placement', 'products']);

        // Mark previous results resolved
        CampaignValidationResult::where('campaign_draft_id', $draft->id)
            ->where('is_resolved', false)
            ->update(['is_resolved' => true, 'resolved_at' => now()]);

        $results = [];

        $results = array_merge($results, $this->validateBudget($draft));
        $results = array_merge($results, $this->validateAssets($draft));
        $results = array_merge($results, $this->validateCreatives($draft));
        $results = array_merge($results, $this->validateAudience($draft));
        $results = array_merge($results, $this->validateSchedule($draft));
        $results = array_merge($results, $this->validateGovernance($draft));
        $results = array_merge($results, $this->validateCommerceProducts($draft));

        foreach ($results as $result) {
            CampaignValidationResult::create(array_merge($result, ['campaign_draft_id' => $draft->id]));
        }

        $blocking = collect($results)->where('severity', ValidationSeverity::BLOCKING->value)->count();
        $warnings = collect($results)->where('severity', ValidationSeverity::WARNING->value)->count();

        return [
            'total_issues' => count($results),
            'blocking_errors' => $blocking,
            'warnings' => $warnings,
            'can_publish' => $blocking === 0,
            'results' => $results,
        ];
    }

    private function validateBudget(CampaignDraft $draft): array
    {
        $issues = [];

        if (! $draft->budget_type) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'budget', 'Budget type is required.', 'budget_type');
        }

        $hasBudget = ($draft->budget_type?->value === 'daily' && $draft->daily_budget > 0)
            || ($draft->budget_type?->value === 'lifetime' && $draft->lifetime_budget > 0);

        if (! $hasBudget) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'budget', 'A budget amount is required.', 'daily_budget');
        }

        if ($draft->daily_budget && $draft->daily_budget < 1) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'budget', 'Daily budget must be at least $1.00.', 'daily_budget');
        }

        return $issues;
    }

    private function validateAssets(CampaignDraft $draft): array
    {
        $issues = [];

        if (! $draft->ad_account_id) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'assets', 'Ad Account is required.', 'ad_account_id');
        }
        if (! $draft->page_id) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'assets', 'Facebook Page is required.', 'page_id');
        }
        if (! $draft->pixel_id) {
            $issues[] = $this->issue(ValidationSeverity::WARNING, 'pixel', 'No Pixel connected. Conversion tracking will be unavailable.', 'pixel_id');
        }
        if (! $draft->connection_id) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'assets', 'Marketing Connection is required.', 'connection_id');
        }

        return $issues;
    }

    private function validateCreatives(CampaignDraft $draft): array
    {
        $issues = [];

        if ($draft->creatives->isEmpty()) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'creative', 'At least one creative is required.', 'creatives');

            return $issues;
        }

        foreach ($draft->creatives as $creative) {
            if (! $creative->primary_text && ! $creative->headline) {
                $issues[] = $this->issue(ValidationSeverity::WARNING, 'creative', 'Creative is missing primary text or headline.', "creatives.{$creative->id}");
            }
            if (! $creative->destination_url) {
                $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'url', "Creative #{$creative->sort_order} is missing a destination URL.", "creatives.{$creative->id}.destination_url");
            }
        }

        return $issues;
    }

    private function validateAudience(CampaignDraft $draft): array
    {
        $issues = [];

        if (! $draft->audience) {
            $issues[] = $this->issue(ValidationSeverity::WARNING, 'audience', 'Audience targeting is not configured.', 'audience');

            return $issues;
        }

        $audience = $draft->audience;

        if (empty($audience->countries) && empty($audience->governorates) && empty($audience->cities)) {
            $issues[] = $this->issue(ValidationSeverity::WARNING, 'audience', 'No geographic targeting configured.', 'audience.countries');
        }

        if ($audience->age_min && $audience->age_max && $audience->age_min >= $audience->age_max) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'audience', 'Minimum age must be less than maximum age.', 'audience.age_min');
        }

        return $issues;
    }

    private function validateSchedule(CampaignDraft $draft): array
    {
        $issues = [];

        if ($draft->start_date && $draft->end_date && $draft->start_date >= $draft->end_date) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'schedule', 'End date must be after start date.', 'end_date');
        }

        if ($draft->start_date && $draft->start_date->isPast()) {
            $issues[] = $this->issue(ValidationSeverity::WARNING, 'schedule', 'Start date is in the past.', 'start_date');
        }

        return $issues;
    }

    private function validateGovernance(CampaignDraft $draft): array
    {
        $issues = [];

        $policy = $draft->governance_policy_id
            ? GovernancePolicy::find($draft->governance_policy_id)
            : GovernancePolicy::where('is_default', true)
                ->where(fn ($q) => $q->where('company_id', $draft->company_id)->orWhereNull('company_id'))
                ->first();

        if (! $policy) {
            return $issues;
        }

        if ($policy->min_daily_budget && $draft->daily_budget && $draft->daily_budget < $policy->min_daily_budget) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'policy', "Budget below minimum policy requirement of {$policy->min_daily_budget}.", 'daily_budget');
        }

        if ($policy->max_daily_budget && $draft->daily_budget && $draft->daily_budget > $policy->max_daily_budget) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'policy', "Budget exceeds maximum policy limit of {$policy->max_daily_budget}.", 'daily_budget');
        }

        if ($policy->pixel_required && ! $draft->pixel_id) {
            $issues[] = $this->issue(ValidationSeverity::BLOCKING, 'policy', 'Governance policy requires a Pixel to be connected.', 'pixel_id');
        }

        if ($policy->naming_pattern && $draft->name && ! preg_match($policy->naming_pattern, $draft->name)) {
            $issues[] = $this->issue(ValidationSeverity::WARNING, 'naming', "Campaign name does not match naming standard. Example: {$policy->naming_example}", 'name');
        }

        return $issues;
    }

    private function validateCommerceProducts(CampaignDraft $draft): array
    {
        $issues = [];

        foreach ($draft->products->filter->hasAvailabilityIssue() as $product) {
            $issues[] = $this->issue(
                ValidationSeverity::WARNING,
                'commerce',
                "Product \"{$product->product_name}\" is {$product->availability_status}. Consider removing it before publishing.",
                "products.{$product->id}",
            );
        }

        return $issues;
    }

    private function issue(ValidationSeverity $severity, string $type, string $message, ?string $field = null): array
    {
        return [
            'validation_type' => $type,
            'severity' => $severity->value,
            'message' => $message,
            'field_path' => $field,
            'is_resolved' => false,
        ];
    }
}
