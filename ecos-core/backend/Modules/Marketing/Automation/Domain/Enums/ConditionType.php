<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Enums;

enum ConditionType: string
{
    case CUSTOMER_SEGMENT = 'customer_segment';
    case LTV = 'ltv';
    case COMPANY = 'company';
    case BRAND = 'brand';
    case CHANNEL = 'channel';
    case PRODUCT = 'product';
    case CATEGORY = 'category';
    case CAMPAIGN = 'campaign';
    case INITIATIVE = 'initiative';
    case CONVERSATION_INTENT = 'conversation_intent';
    case LEAD_SCORE = 'lead_score';
    case ORDER_COUNT = 'order_count';
    case PURCHASE_VALUE = 'purchase_value';
    case LAST_ACTIVITY = 'last_activity';
    case BUSINESS_DNA = 'business_dna';
    case CUSTOM_RULE = 'custom_rule';

    public function requiresNumericOperator(): bool
    {
        return in_array($this, [
            self::LTV,
            self::LEAD_SCORE,
            self::ORDER_COUNT,
            self::PURCHASE_VALUE,
            self::LAST_ACTIVITY,
        ], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::CUSTOMER_SEGMENT => 'Customer Segment',
            self::LTV => 'Lifetime Value',
            self::COMPANY => 'Company',
            self::BRAND => 'Brand',
            self::CHANNEL => 'Sales Channel',
            self::PRODUCT => 'Product',
            self::CATEGORY => 'Category',
            self::CAMPAIGN => 'Campaign',
            self::INITIATIVE => 'Initiative',
            self::CONVERSATION_INTENT => 'Conversation Intent',
            self::LEAD_SCORE => 'Lead Score',
            self::ORDER_COUNT => 'Order Count',
            self::PURCHASE_VALUE => 'Total Purchase Value',
            self::LAST_ACTIVITY => 'Days Since Last Activity',
            self::BUSINESS_DNA => 'Business DNA',
            self::CUSTOM_RULE => 'Custom Rule',
        };
    }
}
