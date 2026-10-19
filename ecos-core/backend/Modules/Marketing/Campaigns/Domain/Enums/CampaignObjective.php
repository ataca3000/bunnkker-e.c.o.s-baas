<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Enums;

enum CampaignObjective: string
{
    case AppInstalls = 'APP_INSTALLS';
    case BrandAwareness = 'BRAND_AWARENESS';
    case Conversions = 'CONVERSIONS';
    case EventResponses = 'EVENT_RESPONSES';
    case LeadGeneration = 'LEAD_GENERATION';
    case LinkClicks = 'LINK_CLICKS';
    case LocalAwareness = 'LOCAL_AWARENESS';
    case Messages = 'MESSAGES';
    case Outcome = 'OUTCOME_AWARENESS';
    case OutcomeEngagement = 'OUTCOME_ENGAGEMENT';
    case OutcomeLeads = 'OUTCOME_LEADS';
    case OutcomeSales = 'OUTCOME_SALES';
    case OutcomeTraffic = 'OUTCOME_TRAFFIC';
    case OutcomeApp = 'OUTCOME_APP_PROMOTION';
    case PageLikes = 'PAGE_LIKES';
    case PostEngagement = 'POST_ENGAGEMENT';
    case ProductCatalogSales = 'PRODUCT_CATALOG_SALES';
    case Reach = 'REACH';
    case StoreVisits = 'STORE_VISITS';
    case TrafficOld = 'TRAFFIC';
    case VideoViews = 'VIDEO_VIEWS';

    public function label(): string
    {
        return match ($this) {
            self::AppInstalls => 'App Installs',
            self::BrandAwareness => 'Brand Awareness',
            self::Conversions => 'Conversions',
            self::EventResponses => 'Event Responses',
            self::LeadGeneration => 'Lead Generation',
            self::LinkClicks => 'Link Clicks',
            self::LocalAwareness => 'Local Awareness',
            self::Messages => 'Messages',
            self::Outcome => 'Awareness',
            self::OutcomeEngagement => 'Engagement',
            self::OutcomeLeads => 'Leads',
            self::OutcomeSales => 'Sales',
            self::OutcomeTraffic => 'Traffic',
            self::OutcomeApp => 'App Promotion',
            self::PageLikes => 'Page Likes',
            self::PostEngagement => 'Post Engagement',
            self::ProductCatalogSales => 'Catalog Sales',
            self::Reach => 'Reach',
            self::StoreVisits => 'Store Visits',
            self::TrafficOld => 'Traffic',
            self::VideoViews => 'Video Views',
        };
    }

    /** Try to create from an unknown string without throwing. */
    public static function tryFromLabel(string $value): self
    {
        return self::tryFrom($value) ?? self::Conversions;
    }
}
