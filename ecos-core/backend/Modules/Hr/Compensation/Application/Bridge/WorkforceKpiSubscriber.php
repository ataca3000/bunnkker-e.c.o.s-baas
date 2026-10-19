<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Application\Bridge;

use Modules\Hr\Compensation\Domain\Services\KpiFactService;

/**
 * The bridge subscriber: it receives an operational domain event from the
 * enterprise bus, translates it through the catalog, and records the fact.
 *
 * ┌─ ZERO COUPLING · SAFE-BY-DEFAULT ───────────────────────────────────────┐
 * │ The event is read purely through its marker contract (eventName / eventId  │
 * │ / toArray) by duck typing, so HR imports NO operational class. It is        │
 * │ registered on the bus only when hr.kpi.auto_subscribe is enabled — off by  │
 * │ default, so existing environments see no behaviour change and turning it   │
 * │ on is a deliberate decision once employees are mapped to operational       │
 * │ actors. An event it cannot attribute is dropped, never guessed.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class WorkforceKpiSubscriber
{
    public function __construct(
        private readonly WorkforceKpiCatalog $catalog,
        private readonly KpiFactService $facts,
    ) {}

    /** Enterprise-bus entry point. */
    public function handle(object $event): void
    {
        $this->consume($event);
    }

    /** Invokable form, for buses that call subscribers as callables. */
    public function __invoke(object $event): void
    {
        $this->consume($event);
    }

    /** Returns whether a workforce fact was recorded — useful in tests and sync paths. */
    public function consume(object $event): bool
    {
        $name = $this->call($event, 'eventName');
        $id = $this->call($event, 'eventId');
        $payload = $this->call($event, 'toArray');

        if (! is_string($name) || ! is_array($payload)) {
            return false;
        }

        $fact = $this->catalog->translate($name, is_string($id) ? $id : $name.':'.spl_object_hash($event), $payload);

        if ($fact === null) {
            return false;
        }

        $this->facts->record($fact);

        return true;
    }

    /** Read a method off the event if it exposes one — never assume it does. */
    private function call(object $event, string $method): mixed
    {
        return method_exists($event, $method) ? $event->{$method}() : null;
    }
}
