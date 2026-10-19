<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Cart Settings
    |--------------------------------------------------------------------------
    */
    'cart' => [
        'held_expiry_hours' => env('POS_HELD_CART_EXPIRY_HOURS', 8),
        'max_items' => env('POS_CART_MAX_ITEMS', 500),
    ],

    /*
    |--------------------------------------------------------------------------
    | Payment Settings
    |--------------------------------------------------------------------------
    */
    'payment' => [
        'allow_partial' => env('POS_ALLOW_PARTIAL_PAYMENT', true),
        'cash_rounding_method' => env('POS_CASH_ROUNDING_METHOD', 'nearest'),  // nearest | up | down
        'cash_rounding_unit' => env('POS_CASH_ROUNDING_UNIT', '0.25'),
        'store_credit_enabled' => env('POS_STORE_CREDIT_ENABLED', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Discount Settings
    |--------------------------------------------------------------------------
    */
    'discount' => [
        'max_item_discount_pct' => env('POS_MAX_ITEM_DISCOUNT_PCT', 100),
        'max_order_discount_pct' => env('POS_MAX_ORDER_DISCOUNT_PCT', 100),
        'require_manager_above_pct' => env('POS_MANAGER_APPROVAL_PCT', 20),
    ],

    /*
    |--------------------------------------------------------------------------
    | Shift & Session Settings
    |--------------------------------------------------------------------------
    */
    'shift' => [
        'cash_variance_tolerance_pct' => env('POS_CASH_VARIANCE_TOLERANCE_PCT', 5),
        'max_cash_out_amount' => env('POS_MAX_CASH_OUT_AMOUNT', 5000),
        'require_opening_count' => env('POS_REQUIRE_OPENING_COUNT', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Returns & Exchanges
    |--------------------------------------------------------------------------
    */
    'returns' => [
        'window_days' => env('POS_RETURN_WINDOW_DAYS', 30),
        'allow_without_receipt' => env('POS_RETURN_WITHOUT_RECEIPT', false),
        'require_reason' => env('POS_RETURN_REQUIRE_REASON', true),
        'restock_by_default' => env('POS_RETURN_RESTOCK_BY_DEFAULT', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Inventory Integration
    |--------------------------------------------------------------------------
    */
    'inventory' => [
        'allow_negative_stock' => env('POS_ALLOW_NEGATIVE_STOCK', false),
        'use_offline_inventory' => env('POS_USE_OFFLINE_INVENTORY', true),
        'offline_sync_interval_sec' => env('POS_OFFLINE_SYNC_INTERVAL', 300),
    ],

    /*
    |--------------------------------------------------------------------------
    | Offline Mode
    |--------------------------------------------------------------------------
    */
    'offline' => [
        'enabled' => env('POS_OFFLINE_ENABLED', true),
        'max_queue_size' => env('POS_OFFLINE_MAX_QUEUE', 1000),
        'encryption_algorithm' => env('POS_OFFLINE_ENCRYPTION', 'AES-256-GCM'),
        'conflict_strategy' => env('POS_OFFLINE_CONFLICT_STRATEGY', 'server_wins'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Hardware Abstraction Layer
    |--------------------------------------------------------------------------
    */
    'hal' => [
        'agent_ws_url' => env('POS_HAL_AGENT_URL', 'ws://localhost:8765'),
        'agent_connect_timeout' => env('POS_HAL_AGENT_TIMEOUT_MS', 3000),
    ],

    /*
    |--------------------------------------------------------------------------
    | Loyalty / CRM Integration
    |--------------------------------------------------------------------------
    */
    'loyalty' => [
        'enabled' => env('POS_LOYALTY_ENABLED', true),
        'points_per_currency' => env('POS_POINTS_PER_CURRENCY', 1),
        'currency_per_point' => env('POS_CURRENCY_PER_POINT', '0.01'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Pricing Integration Settings
    |--------------------------------------------------------------------------
    */
    'pricing' => [
        'default_currency' => env('POS_DEFAULT_CURRENCY', 'EGP'),
        'prefer_sale_price' => env('POS_PRICING_PREFER_SALE_PRICE', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Receipt Settings
    |--------------------------------------------------------------------------
    */
    'receipt' => [
        'default_format' => env('POS_RECEIPT_FORMAT', 'thermal_80mm'),
        'print_on_sale' => env('POS_RECEIPT_AUTO_PRINT', true),
        'email_on_sale' => env('POS_RECEIPT_AUTO_EMAIL', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | ERP Integration
    |--------------------------------------------------------------------------
    |
    | guest_customer_id — UUID of the Customer record used for anonymous
    | (walk-in) POS sales. Set POS_GUEST_CUSTOMER_ID in .env to a valid
    | Customer UUID. When null, ERP orders are not created for walk-in sales.
    |
    */
    'erp' => [
        'guest_customer_id' => env('POS_GUEST_CUSTOMER_ID', null),
    ],

];
