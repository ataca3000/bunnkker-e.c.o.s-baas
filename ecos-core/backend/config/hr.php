<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Workforce KPI collection
    |--------------------------------------------------------------------------
    |
    | When auto_subscribe is enabled, HR listens on the enterprise event bus for
    | the operational events in the WorkforceKpiCatalog and records a workforce
    | KPI fact for each one it can attribute to an employee.
    |
    | It is OFF by default on purpose. The catalog reads an employee id off the
    | operational payload, so until the operational modules carry one the bridge
    | would translate nothing — and a half-collected month is worse than none,
    | because commission would silently under-pay. Turn it on per environment
    | once employees are mapped to operational actors; until then facts arrive
    | through POST /api/hr/kpi/facts.
    |
    */
    'kpi' => [
        'auto_subscribe' => env('HR_KPI_AUTO_SUBSCRIBE', false),
    ],
];
