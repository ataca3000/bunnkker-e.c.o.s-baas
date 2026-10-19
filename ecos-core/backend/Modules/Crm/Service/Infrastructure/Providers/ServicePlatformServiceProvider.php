<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Crm\Service\Domain\Services\AssignmentEngine;
use Modules\Crm\Service\Domain\Services\EscalationEngine;
use Modules\Crm\Service\Domain\Services\KnowledgeBaseService;
use Modules\Crm\Service\Domain\Services\ResolutionLibraryService;
use Modules\Crm\Service\Domain\Services\SlaService;
use Modules\Crm\Service\Domain\Services\TicketService;

/**
 * CRM Customer Service — EPIC C3.
 *
 * ┌─ THE CRM OWNS SERVICE CASES ────────────────────────────────────────────┐
 * │ Tickets, complaints, service requests, RMA returns and warranty cases,     │
 * │ with SLA, assignment, escalation, a resolution workflow, notes, a          │
 * │ knowledge base and a resolution library. It integrates with Finance,       │
 * │ Inventory and Shipping BY REFERENCE ONLY — it imports and owns none of      │
 * │ their data.                                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ServicePlatformServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(SlaService::class);
        $this->app->singleton(AssignmentEngine::class);
        $this->app->singleton(TicketService::class);
        $this->app->singleton(EscalationEngine::class);
        $this->app->singleton(KnowledgeBaseService::class);
        $this->app->singleton(ResolutionLibraryService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
