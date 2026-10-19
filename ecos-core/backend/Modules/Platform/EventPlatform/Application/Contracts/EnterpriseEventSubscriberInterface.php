<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Application\Contracts;

use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

interface EnterpriseEventSubscriberInterface
{
    public function handle(DomainEvent $event): void;

    /** The event name(s) this subscriber handles — dot-notation, e.g. 'preparation.wave_created' */
    public function subscribesTo(): array;

    /** Minimum supported event schema version (e.g. 1). */
    public function minSupportedVersion(): int;

    /** Maximum supported event schema version — 0 means no upper bound. */
    public function maxSupportedVersion(): int;
}
