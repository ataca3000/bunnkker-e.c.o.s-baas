<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Enums;

enum TemplateCategory: string
{
    case SALES = 'sales';
    case LEAD_GENERATION = 'lead_generation';
    case CATALOG_SALES = 'catalog_sales';
    case AWARENESS = 'awareness';
    case RETARGETING = 'retargeting';
    case SEASONAL = 'seasonal';
    case WHATSAPP = 'whatsapp';
    case MESSENGER = 'messenger';
    case PRODUCT_LAUNCH = 'product_launch';
    case CUSTOM = 'custom';

    public function label(): string
    {
        return match ($this) {
            self::SALES => 'Sales Campaign',
            self::LEAD_GENERATION => 'Lead Generation',
            self::CATALOG_SALES => 'Catalog Sales',
            self::AWARENESS => 'Awareness',
            self::RETARGETING => 'Retargeting',
            self::SEASONAL => 'Seasonal Promotion',
            self::WHATSAPP => 'WhatsApp Campaign',
            self::MESSENGER => 'Messenger Campaign',
            self::PRODUCT_LAUNCH => 'Product Launch',
            self::CUSTOM => 'Custom Template',
        };
    }
}
