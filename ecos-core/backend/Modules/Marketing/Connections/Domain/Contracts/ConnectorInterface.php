<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Contracts;

/**
 * @deprecated Use MarketingConnectorInterface directly.
 *
 * Kept as a backward-compat alias so existing type-hints continue to resolve.
 * MarketingConnectorInterface is a strict superset — any class implementing
 * MarketingConnectorInterface automatically satisfies this interface too.
 */
interface ConnectorInterface extends MarketingConnectorInterface
{
    // No additional methods — this is a pure compatibility shim.
}
