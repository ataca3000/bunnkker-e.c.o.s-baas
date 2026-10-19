<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Domain\Enums;

/**
 * Known preference categories across the ERP.
 *
 * The API accepts ANY valid category string (not restricted to this enum),
 * so new modules can introduce their own categories without touching this file.
 * This enum serves as the canonical reference for first-party categories and
 * their documented payload shapes.
 *
 * TABLE CATEGORIES (products, orders, customers, …)
 *   Expected payload shape:
 *   {
 *     "columns":     { "image": true, "sku": false, … },  // ColKey → visible
 *     "column_order": ["name", "sku", "price", …],        // display order
 *     "column_widths": { "name": 240, "sku": 120, … },    // px overrides
 *     "density":     "comfortable" | "compact",
 *     "sort":        { "field": "name", "direction": "asc" },
 *     "page_size":   25,
 *     "filter_presets": [
 *       { "id": "uuid", "name": "Low Stock", "filters": { … } }
 *     ]
 *   }
 *
 * THEME
 *   { "theme": "light" | "dark" | "system", "language": "en", "timezone": "UTC" }
 *
 * WORKSPACE
 *   { "default_company": "uuid", "default_branch": "uuid", "default_warehouse": "uuid" }
 */
enum PreferenceCategory: string
{
    // ── Table categories ───────────────────────────────────────────────────────
    case Products = 'products';
    case Orders = 'orders';
    case Customers = 'customers';
    case Suppliers = 'suppliers';
    case Inventory = 'inventory';
    case Purchasing = 'purchasing';
    case Manufacturing = 'manufacturing';
    case Reports = 'reports';
    case Dashboard = 'dashboard';

    // ── User-level settings ────────────────────────────────────────────────────
    case Theme = 'theme';
    case Workspace = 'workspace';

    // ── Default payload shapes ────────────────────────────────────────────────

    /**
     * Return the default payload for this category so reset actions have a
     * source of truth. Returning null means "remove the row entirely".
     *
     * @return array<string, mixed>|null
     */
    public function defaultPayload(): ?array
    {
        return match ($this) {
            self::Theme => self::defaultTheme(),
            self::Workspace => self::defaultWorkspace(),
            default => self::defaultTablePreferences(),
        };
    }

    /** @return array<string, mixed> */
    private static function defaultTablePreferences(): array
    {
        return [
            'columns' => [],
            'column_order' => [],
            'column_widths' => [],
            'density' => 'comfortable',
            'sort' => ['field' => null, 'direction' => 'asc'],
            'page_size' => 25,
            'filter_presets' => [],
        ];
    }

    /** @return array<string, mixed> */
    private static function defaultTheme(): array
    {
        return [
            'theme' => 'system',
            'language' => 'en',
            'timezone' => 'UTC',
        ];
    }

    /** @return array<string, mixed> */
    private static function defaultWorkspace(): array
    {
        return [
            'default_company' => null,
            'default_branch' => null,
            'default_warehouse' => null,
        ];
    }
}
