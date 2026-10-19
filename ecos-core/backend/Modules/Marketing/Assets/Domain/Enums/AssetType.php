<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\Enums;

/**
 * Provider-independent asset types.
 *
 * The type identifies the business object; the connector_type column
 * on marketing_assets identifies the source platform.
 * No type should encode a platform name (no "meta_pixel", no "facebook_page").
 *
 * Legacy Meta-specific cases are preserved for backward-compat with existing
 * DB rows — new discovery always uses the canonical provider-agnostic case.
 */
enum AssetType: string
{
    // ── Canonical provider-agnostic types ─────────────────────────────────────

    /** Business Manager / Business Account umbrella (e.g. Meta BM, Google MCC). */
    case BusinessAccount = 'business_account';

    /** Advertising account where spend is managed. */
    case AdAccount = 'ad_account';

    /** A brand or company page on a social platform. */
    case Page = 'page';

    /**
     * Any professional social profile (Instagram, LinkedIn, TikTok, etc.).
     * The specific sub-type is stored in asset_metadata['social_type'].
     */
    case SocialAccount = 'social_account';

    /** Tracking pixel / tag for conversion and event tracking. */
    case Pixel = 'pixel';

    /** Product catalog / feed. */
    case Catalog = 'catalog';

    /** A verified domain associated with the platform account. */
    case Domain = 'domain';

    /** Platform dataset (Conversions API, offline events, etc.). */
    case Dataset = 'dataset';

    /** Mobile or web application registered on the platform. */
    case App = 'app';

    /** A product within a catalog. */
    case Product = 'product';

    /** A named collection (subset) of catalog products. */
    case ProductSet = 'product_set';

    // ── Legacy values — backward-compat with existing DB rows ────────────────
    // @deprecated  New discovery should use BusinessAccount / SocialAccount.

    /** @deprecated Use BusinessAccount */
    case BusinessManager = 'business_manager';

    /** @deprecated Use SocialAccount with metadata['social_type'] = 'instagram' */
    case InstagramAccount = 'instagram_account';

    /** @deprecated Use SocialAccount with metadata['social_type'] = 'whatsapp' */
    case WhatsAppAccount = 'whatsapp_account';

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function label(): string
    {
        return match ($this) {
            self::BusinessAccount => 'Business Account',
            self::AdAccount => 'Ad Account',
            self::Page => 'Page',
            self::SocialAccount => 'Social Account',
            self::Pixel => 'Pixel',
            self::Catalog => 'Product Catalog',
            self::Domain => 'Domain',
            self::Dataset => 'Dataset',
            self::App => 'App',
            self::Product => 'Product',
            self::ProductSet => 'Product Set',
            // Legacy
            self::BusinessManager => 'Business Manager (legacy)',
            self::InstagramAccount => 'Instagram Account (legacy)',
            self::WhatsAppAccount => 'WhatsApp Account (legacy)',
        };
    }

    /** Returns true if this is a canonical (non-legacy) type. */
    public function isCanonical(): bool
    {
        return ! in_array($this, [
            self::BusinessManager,
            self::InstagramAccount,
            self::WhatsAppAccount,
        ], true); // Product + ProductSet are canonical; legacy types are not
    }

    /**
     * Return the canonical equivalent of a legacy type.
     * Returns self if already canonical.
     */
    public function canonical(): self
    {
        return match ($this) {
            self::BusinessManager => self::BusinessAccount,
            self::InstagramAccount, self::WhatsAppAccount => self::SocialAccount,
            default => $this,
        };
    }

    /** @return list<self>  Only canonical (non-legacy) types. */
    public static function allCanonical(): array
    {
        return [
            self::BusinessAccount,
            self::AdAccount,
            self::Page,
            self::SocialAccount,
            self::Pixel,
            self::Catalog,
            self::Domain,
            self::Dataset,
            self::App,
            self::Product,
            self::ProductSet,
        ];
    }
}
