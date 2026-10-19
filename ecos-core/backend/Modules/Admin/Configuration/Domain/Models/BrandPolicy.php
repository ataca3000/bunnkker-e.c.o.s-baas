<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Organization\Brands\Domain\Models\Brand;

/**
 * Flexible JSON policy store for a brand + policy group.
 *
 * Each row holds the complete settings for one policy domain.
 * Version increments on every update (immutable history kept in config_audit_log).
 *
 * @property string $id
 * @property string $brand_id
 * @property string $company_id
 * @property string $policy_group e.g. 'preparation', 'pricing', 'inventory'
 * @property array $settings
 * @property int $version
 * @property bool $is_active
 */
class BrandPolicy extends Model
{
    use HasUuids;

    protected $table = 'config_brand_policies';

    public $incrementing = false;

    protected $keyType = 'string';

    /** All recognized policy group keys. */
    public const POLICY_GROUPS = [
        'preparation', 'pricing', 'inventory', 'manufacturing', 'order',
        'logistics', 'crm', 'marketing', 'ai', 'workflow',
        'notification', 'integration', 'security', 'numbering', 'approval',
    ];

    /** @var list<string> */
    protected $fillable = [
        'brand_id',
        'company_id',
        'policy_group',
        'settings',
        'version',
        'is_active',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'is_active' => 'boolean',
            'version' => 'integer',
        ];
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /**
     * Returns a sensible empty settings structure for a given policy group.
     * Used when no policy row exists yet for the brand.
     */
    public static function defaultSettings(string $group): array
    {
        return match ($group) {
            'preparation' => self::defaultPreparationSettings(),
            'pricing' => self::defaultPricingSettings(),
            'inventory' => self::defaultInventorySettings(),
            'manufacturing' => self::defaultManufacturingSettings(),
            'order' => self::defaultOrderSettings(),
            'logistics' => self::defaultLogisticsSettings(),
            'crm' => self::defaultCrmSettings(),
            'marketing' => self::defaultMarketingSettings(),
            'ai' => self::defaultAiSettings(),
            'workflow' => self::defaultWorkflowSettings(),
            'notification' => self::defaultNotificationSettings(),
            'integration' => self::defaultIntegrationSettings(),
            'security' => self::defaultSecuritySettings(),
            'numbering' => self::defaultNumberingSettings(),
            'approval' => self::defaultApprovalSettings(),
            default => [],
        };
    }

    private static function defaultPreparationSettings(): array
    {
        return [
            'wave_generation' => 'auto',
            'wave_priority' => 'fifo',
            'batch_size' => 50,
            'merge_orders' => true,
            'split_orders' => false,
            'partial_preparation' => false,
            'negative_stock_handling' => 'block',
            'packing_strategy' => 'standard',
            'exception_handling' => 'notify',
        ];
    }

    private static function defaultPricingSettings(): array
    {
        return [
            'auto_price_review' => true,
            'minimum_margin_pct' => 20,
            'discount_type' => 'percentage',
            'discount_value' => 15.0,
            'required_approval_above' => null,
            'publishing_strategy' => 'automatic',
            'pending_review_threshold' => 5,
            'price_expiration_days' => null,
        ];
    }

    private static function defaultInventorySettings(): array
    {
        return [
            'allow_negative_stock' => false,
            'reservation_method' => 'fifo',
            'costing_method' => 'fifo',
            'cycle_count_frequency_days' => 30,
            'stock_alert_threshold_pct' => 20,
            'auto_reorder' => false,
        ];
    }

    private static function defaultManufacturingSettings(): array
    {
        return [
            'recipe_version_policy' => 'latest',
            'recipe_approval_required' => false,
            'auto_manufacturing' => false,
            'bom_validation' => true,
            'waste_rules_enabled' => true,
            'cost_refresh_on_production' => true,
        ];
    }

    private static function defaultOrderSettings(): array
    {
        return [
            'source_entry_policies' => [
                'manual' => ['pending', 'awaiting_payment', 'processing', 'confirmed'],
                'pos' => 'processing',
                'woocommerce' => 'preserve',
                'public_api' => 'preserve',
            ],
            'payment_proof_policy' => [
                'cod' => 'none',
                'instapay' => 'required',
                'bank_transfer' => 'required',
                'mobile_wallet' => 'required',
                'credit_card' => 'optional',
            ],
            'auto_reserve_inventory' => false,
            'customer_matching_policy' => 'reuse_existing',
            'require_phone' => true,
            'require_address' => true,
            'customer_lookup_enabled' => true,
            'deposit_policy' => 'none',
            'discount_policy' => 'manager_approval',
        ];
    }

    private static function defaultLogisticsSettings(): array
    {
        return [
            'vehicle_assignment' => 'manual',
            'driver_assignment' => 'manual',
            'max_stops_per_route' => 20,
            'partial_delivery' => true,
            'failed_delivery' => 'return_to_warehouse',
        ];
    }

    private static function defaultCrmSettings(): array
    {
        return [
            'vip_order_threshold' => 10,
            'delivery_success_threshold' => 90,
            'follow_up_after_days' => 7,
            'loyalty_enabled' => false,
        ];
    }

    private static function defaultMarketingSettings(): array
    {
        return [
            'default_utm_source' => null,
            'campaign_attribution' => 'last_click',
            'conversion_window_days' => 30,
        ];
    }

    private static function defaultAiSettings(): array
    {
        return [
            'confidence_threshold' => 0.85,
            'auto_decision_enabled' => false,
            'prediction_rules' => [],
            'alert_threshold' => 0.7,
        ];
    }

    private static function defaultWorkflowSettings(): array
    {
        return [
            'order_workflow' => 'standard',
            'preparation_workflow' => 'standard',
            'procurement_workflow' => 'standard',
        ];
    }

    private static function defaultNotificationSettings(): array
    {
        return [
            'email_enabled' => true,
            'sms_enabled' => false,
            'whatsapp_enabled' => false,
            'push_enabled' => false,
            'escalation_after_minutes' => 60,
        ];
    }

    private static function defaultIntegrationSettings(): array
    {
        return [
            'woocommerce_enabled' => false,
            'meta_enabled' => false,
            'google_enabled' => false,
        ];
    }

    private static function defaultSecuritySettings(): array
    {
        return [
            'session_timeout_minutes' => 480,
            'max_login_attempts' => 5,
            'mfa_enabled' => false,
            'password_expiry_days' => null,
        ];
    }

    private static function defaultNumberingSettings(): array
    {
        return [
            'order_prefix' => 'ORD',
            'invoice_prefix' => 'INV',
            'purchase_prefix' => 'PO',
            'session_prefix' => 'PREP',
            'count_prefix' => 'CNT',
            'transfer_prefix' => 'TRF',
            'return_prefix' => 'RET',
            'sequence_padding' => 6,
        ];
    }

    private static function defaultApprovalSettings(): array
    {
        return [
            'price_approval_required' => false,
            'recipe_approval_required' => false,
            'purchase_approval_threshold' => null,
            'discount_approval_required' => true,
            'refund_approval_required' => true,
        ];
    }
}
