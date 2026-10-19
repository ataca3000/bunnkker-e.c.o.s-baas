<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Infrastructure\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Modules\System\Engineering\Application\Listeners\Pipeline\NotifyOnPipelineEventListener;
use Modules\System\Engineering\Application\Services\AgentArtifactService;
use Modules\System\Engineering\Application\Services\AgentHeartbeatService;
use Modules\System\Engineering\Application\Services\AgentRegistrationService;
use Modules\System\Engineering\Application\Services\EngineeringTaskService;
use Modules\System\Engineering\Application\Services\ExecutionSessionService;
use Modules\System\Engineering\Application\Services\ImportEngineeringReportService;
use Modules\System\Engineering\Application\Services\PipelineAnalyticsService;
use Modules\System\Engineering\Application\Services\PipelineNotificationService;
use Modules\System\Engineering\Application\Services\PipelineRecoveryService;
use Modules\System\Engineering\Application\Services\PipelineStageExecutor;
use Modules\System\Engineering\Application\Services\PipelineTemplateEngine;
use Modules\System\Engineering\Application\Services\ReleaseCandidateService;
use Modules\System\Engineering\Application\Services\ReleasePipelineService;
use Modules\System\Engineering\Application\Services\RetryPolicyFactory;
use Modules\System\Engineering\Application\Services\TaskAttachmentService;
use Modules\System\Engineering\Application\Services\TaskCommentService;
use Modules\System\Engineering\Application\Services\TaskDependencyService;
use Modules\System\Engineering\Domain\Contracts\EngineeringRunRepositoryInterface;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineCancelled;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineCompleted;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineCreated;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineFailed;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineStarted;
use Modules\System\Engineering\Domain\Events\Pipeline\StageFailed;
use Modules\System\Engineering\Infrastructure\Registry\ProviderRegistry;
use Modules\System\Engineering\Infrastructure\Repositories\EloquentEngineeringRunRepository;
use Modules\System\Engineering\Presentation\Console\Commands\ImportEngineeringReportCommand;
use Modules\System\Engineering\Application\Services\AIADRValidationEngine;
use Modules\System\Engineering\Application\Services\AILearningEngine;
use Modules\System\Engineering\Application\Services\AIMetricsEngine;
use Modules\System\Engineering\Application\Services\AIRecommendationEngine;
use Modules\System\Engineering\Application\Services\AIReleaseRecommendationEngine;
use Modules\System\Engineering\Application\Services\AIReviewEngine;
use Modules\System\Engineering\Application\Services\AIRiskEngine;
use Modules\System\Engineering\Application\Services\AIScoringEngine;
use Modules\System\Engineering\Application\Services\AISecurityCheckEngine;
use Modules\System\Engineering\Application\Services\AITrendEngine;
use Modules\System\Engineering\Presentation\Console\Commands\RunPipelineCommand;
use Modules\System\Engineering\Application\Services\RepairAuditService;
use Modules\System\Engineering\Application\Services\RetryPolicyEngine;
use Modules\System\Engineering\Application\Services\RootCauseClassifier;
use Modules\System\Engineering\Application\Services\FailureAnalysisEngine;
use Modules\System\Engineering\Application\Services\RepairPromptBuilder;
use Modules\System\Engineering\Application\Services\ClaudeCodeIntegration;
use Modules\System\Engineering\Application\Services\RepairSessionManager;
use Modules\System\Engineering\Application\Services\RepairEngine;
use Modules\System\Engineering\Application\Services\PatchValidatorRegistry;
use Modules\System\Engineering\Application\Services\CommandValidatorRunner;
use Modules\System\Engineering\Application\Services\PatchSecurityValidator;
use Modules\System\Engineering\Application\Services\AdrComplianceValidator;
use Modules\System\Engineering\Application\Services\PatchSafetyRuleEngine;
use Modules\System\Engineering\Application\Services\PatchRollbackService;
use Modules\System\Engineering\Application\Services\ValidationReportService;
use Modules\System\Engineering\Application\Services\SelfHealingPipeline;
use Modules\System\Engineering\Application\Services\GuardianCheckRunner;
use Modules\System\Engineering\Application\Services\GuardianDecisionEngine;
use Modules\System\Engineering\Application\Services\GuardianDiagnosticsEngine;
use Modules\System\Engineering\Application\Services\GuardianEngine;
use Modules\System\Engineering\Application\Services\GuardianPolicyService;
use Modules\System\Engineering\Application\Services\GuardianRepairOrchestrator;
use Modules\System\Engineering\Application\Services\GuardianReportService;
use Modules\System\Engineering\Application\Services\GuardianValidationCoordinator;
use Modules\System\Engineering\Application\Services\IntelAnalyticsEngine;
use Modules\System\Engineering\Application\Services\IntelConfidenceScorer;
use Modules\System\Engineering\Application\Services\IntelDebtAnalyzer;
use Modules\System\Engineering\Application\Services\IntelInsightsEngine;
use Modules\System\Engineering\Application\Services\IntelKnowledgeBase;
use Modules\System\Engineering\Application\Services\IntelLearningEngine;
use Modules\System\Engineering\Application\Services\IntelPatternDetector;
use Modules\System\Engineering\Application\Services\IntelPredictionEngine;
use Modules\System\Engineering\Application\Services\IntelTrendEngine;
use Modules\System\Engineering\Application\Services\WorkspaceAggregationService;

final class EngineeringServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            EngineeringRunRepositoryInterface::class,
            EloquentEngineeringRunRepository::class,
        );

        $this->app->bind(ImportEngineeringReportService::class, function ($app) {
            return new ImportEngineeringReportService(
                $app->make(EngineeringRunRepositoryInterface::class),
            );
        });

        // Provider Registry — resolves CI providers from config
        $this->app->singleton(ProviderRegistry::class);

        // ENG-007 services
        $this->app->singleton(PipelineStageExecutor::class, function ($app) {
            return new PipelineStageExecutor($app->make(ProviderRegistry::class));
        });

        $this->app->singleton(PipelineNotificationService::class);
        $this->app->singleton(PipelineTemplateEngine::class);
        $this->app->singleton(RetryPolicyFactory::class);
        $this->app->singleton(PipelineAnalyticsService::class);
        $this->app->singleton(PipelineRecoveryService::class);

        $this->app->bind(ReleasePipelineService::class, function ($app) {
            return new ReleasePipelineService(
                $app->make(PipelineStageExecutor::class),
                $app->make(PipelineTemplateEngine::class),
                $app->make(RetryPolicyFactory::class),
            );
        });

        // Inbox + Agent services
        $this->app->singleton(EngineeringTaskService::class);
        $this->app->singleton(TaskCommentService::class);
        $this->app->singleton(TaskAttachmentService::class);
        $this->app->singleton(TaskDependencyService::class);
        $this->app->singleton(ReleaseCandidateService::class);
        $this->app->singleton(AgentRegistrationService::class);
        $this->app->singleton(AgentHeartbeatService::class);
        $this->app->singleton(ExecutionSessionService::class);
        $this->app->singleton(AgentArtifactService::class);

        // Cluster services
        $this->app->singleton(\Modules\System\Engineering\Application\Services\WorkspaceManager::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\BranchManager::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ConflictDetector::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ClusterScheduler::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ResourceManager::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\WorkerManager::class, function ($app) {
            return new \Modules\System\Engineering\Application\Services\WorkerManager(
                $app->make(\Modules\System\Engineering\Application\Services\WorkspaceManager::class),
                $app->make(\Modules\System\Engineering\Application\Services\BranchManager::class),
                $app->make(\Modules\System\Engineering\Application\Services\ConflictDetector::class),
            );
        });
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ClusterCoordinator::class, function ($app) {
            return new \Modules\System\Engineering\Application\Services\ClusterCoordinator(
                $app->make(\Modules\System\Engineering\Application\Services\ClusterScheduler::class),
                $app->make(\Modules\System\Engineering\Application\Services\WorkerManager::class),
                $app->make(\Modules\System\Engineering\Application\Services\ResourceManager::class),
                $app->make(\Modules\System\Engineering\Application\Services\ConflictDetector::class),
            );
        });
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ClusterHealthService::class, function ($app) {
            return new \Modules\System\Engineering\Application\Services\ClusterHealthService(
                $app->make(\Modules\System\Engineering\Application\Services\ResourceManager::class),
            );
        });
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ClusterRecoveryService::class, function ($app) {
            return new \Modules\System\Engineering\Application\Services\ClusterRecoveryService(
                $app->make(\Modules\System\Engineering\Application\Services\ClusterScheduler::class),
                $app->make(\Modules\System\Engineering\Application\Services\WorkspaceManager::class),
                $app->make(\Modules\System\Engineering\Application\Services\BranchManager::class),
                $app->make(\Modules\System\Engineering\Application\Services\ConflictDetector::class),
            );
        });

        // Release management services
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ReleaseAuditService::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ReleaseValidationService::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ReleaseReadinessScorer::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ReleaseRiskService::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ReleaseReportService::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ReleaseDependencyService::class);
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ReleaseApprovalService::class, function ($app) {
            return new \Modules\System\Engineering\Application\Services\ReleaseApprovalService(
                $app->make(\Modules\System\Engineering\Application\Services\ReleaseAuditService::class),
            );
        });
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ReleasePipelineAdapter::class, function ($app) {
            return new \Modules\System\Engineering\Application\Services\ReleasePipelineAdapter(
                $app->make(\Modules\System\Engineering\Application\Services\ReleaseAuditService::class),
            );
        });
        $this->app->singleton(\Modules\System\Engineering\Application\Services\ReleaseService::class, function ($app) {
            return new \Modules\System\Engineering\Application\Services\ReleaseService(
                $app->make(\Modules\System\Engineering\Application\Services\ReleaseAuditService::class),
            );
        });

        // ENG-009: AI Engineering Supervisor
        $this->app->singleton(AIScoringEngine::class);
        $this->app->singleton(AIRiskEngine::class);
        $this->app->singleton(AIRecommendationEngine::class);
        $this->app->singleton(AIADRValidationEngine::class);
        $this->app->singleton(AISecurityCheckEngine::class);
        $this->app->singleton(AITrendEngine::class);
        $this->app->singleton(AILearningEngine::class);
        $this->app->singleton(AIMetricsEngine::class);
        $this->app->singleton(AIReleaseRecommendationEngine::class);
        $this->app->singleton(AIReviewEngine::class, fn($app) => new AIReviewEngine(
            $app->make(AIScoringEngine::class),
            $app->make(AIRiskEngine::class),
            $app->make(AIRecommendationEngine::class),
            $app->make(AIADRValidationEngine::class),
            $app->make(AISecurityCheckEngine::class),
            $app->make(AITrendEngine::class),
            $app->make(AILearningEngine::class),
            $app->make(AIMetricsEngine::class),
            $app->make(AIReleaseRecommendationEngine::class),
        ));

        // ENG-V2-001: AI Repair Platform
        $this->app->singleton(RepairAuditService::class);
        $this->app->singleton(RetryPolicyEngine::class);
        $this->app->singleton(RootCauseClassifier::class);
        $this->app->singleton(FailureAnalysisEngine::class, function ($app) {
            return new FailureAnalysisEngine($app->make(RootCauseClassifier::class));
        });
        $this->app->singleton(RepairPromptBuilder::class);
        $this->app->singleton(ClaudeCodeIntegration::class);
        $this->app->singleton(RepairSessionManager::class, function ($app) {
            return new RepairSessionManager(
                $app->make(RetryPolicyEngine::class),
                $app->make(RepairAuditService::class)
            );
        });
        $this->app->singleton(RepairEngine::class, function ($app) {
            return new RepairEngine(
                $app->make(RepairSessionManager::class),
                $app->make(FailureAnalysisEngine::class),
                $app->make(RepairPromptBuilder::class),
                $app->make(ClaudeCodeIntegration::class),
                $app->make(RetryPolicyEngine::class),
                $app->make(RepairAuditService::class)
            );
        });

        // ENG-V2-002: Self-Healing Pipeline
        $this->app->singleton(PatchValidatorRegistry::class);
        $this->app->singleton(CommandValidatorRunner::class);
        $this->app->singleton(PatchSecurityValidator::class);
        $this->app->singleton(AdrComplianceValidator::class);
        $this->app->singleton(PatchSafetyRuleEngine::class);
        $this->app->singleton(PatchRollbackService::class);
        $this->app->singleton(ValidationReportService::class);
        $this->app->singleton(SelfHealingPipeline::class, function ($app) {
            return new SelfHealingPipeline(
                $app->make(PatchValidatorRegistry::class),
                $app->make(CommandValidatorRunner::class),
                $app->make(PatchSecurityValidator::class),
                $app->make(AdrComplianceValidator::class),
                $app->make(PatchSafetyRuleEngine::class),
                $app->make(ValidationReportService::class),
                $app->make(PatchRollbackService::class),
                $app->make(AIMetricsEngine::class)
            );
        });

        // ENG-V2-003: Autonomous Engineering Guardian
        $this->app->singleton(GuardianPolicyService::class);
        $this->app->singleton(GuardianDiagnosticsEngine::class);
        $this->app->singleton(GuardianCheckRunner::class);
        $this->app->singleton(GuardianReportService::class);
        $this->app->singleton(GuardianRepairOrchestrator::class);
        $this->app->singleton(GuardianValidationCoordinator::class);
        $this->app->singleton(GuardianDecisionEngine::class);
        $this->app->singleton(GuardianEngine::class);

        // ENG-V2-004: Engineering Intelligence Platform (read-only analytics)
        $this->app->singleton(IntelConfidenceScorer::class);
        $this->app->singleton(IntelKnowledgeBase::class);
        $this->app->singleton(IntelLearningEngine::class);
        $this->app->singleton(IntelPatternDetector::class);
        $this->app->singleton(IntelPredictionEngine::class);
        $this->app->singleton(IntelAnalyticsEngine::class);
        $this->app->singleton(IntelTrendEngine::class);
        $this->app->singleton(IntelDebtAnalyzer::class);
        $this->app->singleton(IntelInsightsEngine::class);

        // ENG-V2-005: Enterprise Engineering Workspace (aggregation only)
        $this->app->singleton(WorkspaceAggregationService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__ . '/../Database/Migrations'
        );

        $this->registerPipelineEventListeners();

        if ($this->app->runningInConsole()) {
            $this->commands([
                ImportEngineeringReportCommand::class,
                RunPipelineCommand::class,
            ]);
        }
    }

    private function registerPipelineEventListeners(): void
    {
        Event::listen(PipelineStarted::class,  function ($e) {
            $this->app->make(NotifyOnPipelineEventListener::class)->handlePipelineStarted($e);
        });

        Event::listen(PipelineCompleted::class, function ($e) {
            $this->app->make(NotifyOnPipelineEventListener::class)->handlePipelineCompleted($e);
        });

        Event::listen(PipelineFailed::class, function ($e) {
            $this->app->make(NotifyOnPipelineEventListener::class)->handlePipelineFailed($e);
        });

        Event::listen(StageFailed::class, function ($e) {
            $this->app->make(NotifyOnPipelineEventListener::class)->handleStageFailed($e);
        });

        Event::listen(PipelineCreated::class, function ($e) {
            $this->app->make(NotifyOnPipelineEventListener::class)->handlePipelineCreated($e);
        });

        Event::listen(PipelineCancelled::class, function ($e) {
            $this->app->make(NotifyOnPipelineEventListener::class)->handlePipelineCancelled($e);
        });
    }
}
