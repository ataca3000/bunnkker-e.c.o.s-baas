<?php

declare(strict_types=1);

namespace Tests\Unit\Manufacturing;

use Error;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeResolverInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\RecipeResolverException;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeComponent;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\Exceptions\NoMatchingRuleException;
use Modules\Manufacturing\DecisionKernel\Domain\Services\DecisionKernel;
use Modules\Manufacturing\DecisionKernel\Domain\Services\InMemoryRuleProvider;
use Modules\Manufacturing\DecisionKernel\Domain\Services\RuleEvaluationPipeline;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionRule;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionTrigger;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Builders\GoodsReceiptContextBuilder;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Builders\ManufacturingContextBuilder;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Exceptions\NoProviderForContextException;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Exceptions\OrchestratorException;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Services\DecisionOrchestrator;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Services\InMemoryRuleProviderRegistry;
use Modules\Manufacturing\DecisionOrchestrator\Domain\ValueObjects\OrchestratorResult;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * PKG-03B: DecisionOrchestrator unit tests.
 *
 * Pure unit tests — no database, no Laravel boot.
 * RecipeResolverInterface is mocked (PHPUnit interface mock).
 * DecisionKernel + RuleEvaluationPipeline used directly (stateless + dependency-free).
 */
class DecisionOrchestratorTest extends TestCase
{
    private RecipeResolverInterface&MockObject $resolver;

    private DecisionKernel $kernel;

    private InMemoryRuleProviderRegistry $registry;

    private DecisionOrchestrator $orchestrator;

    private RecipeSnapshot $snapshot;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resolver = $this->createMock(RecipeResolverInterface::class);
        $this->kernel = new DecisionKernel(new RuleEvaluationPipeline);
        $this->registry = new InMemoryRuleProviderRegistry;
        $this->orchestrator = new DecisionOrchestrator($this->resolver, $this->kernel, $this->registry);
        $this->snapshot = $this->buildSnapshot();
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private function buildSnapshot(
        string $recipeId = 'recipe-001',
        int $version = 1,
        string $productId = 'prod-001',
    ): RecipeSnapshot {
        return new RecipeSnapshot(
            recipe_id: $recipeId,
            bom_number: 'BOM-001',
            version: '1.0',
            bom_version_number: $version,
            product_id: $productId,
            product_sku: 'SKU-001',
            product_name: 'Finished Good',
            components: [
                new RecipeComponent(
                    component_id: 'comp-001',
                    sku: 'COMP-001',
                    name: 'Component One',
                    unit_id: 'unit-001',
                    unit_name: 'Kilogram',
                    unit_symbol: 'kg',
                    quantity: 2.0,
                    allow_negative_stock: false,
                ),
            ],
            resolved_at: '2026-06-29T10:00:00+00:00',
        );
    }

    private function trigger(): DecisionTrigger
    {
        return DecisionTrigger::now('TEST', 'test-001');
    }

    private function approveAllRule(string $ruleId = 'approve-all'): DecisionRule
    {
        return new DecisionRule(
            rule_id: $ruleId,
            name: 'Approve All',
            priority: 100,
            decision_type: DecisionType::Approve,
            reason: new DecisionReason('APPROVED', 'Approved by test rule.'),
            condition: fn (DecisionContext $ctx): bool => true,
        );
    }

    private function rejectAllRule(string $ruleId = 'reject-all'): DecisionRule
    {
        return new DecisionRule(
            rule_id: $ruleId,
            name: 'Reject All',
            priority: 100,
            decision_type: DecisionType::Reject,
            reason: new DecisionReason('REJECTED', 'Rejected by test rule.'),
            condition: fn (DecisionContext $ctx): bool => true,
        );
    }

    private function mfgParams(string $productId = 'prod-001'): array
    {
        return [
            'product_id' => $productId,
            'ordered_qty' => 10.0,
            'available_qty' => 3.0,
            'shortage_qty' => 7.0,
        ];
    }

    private function grParams(): array
    {
        return [
            'gr_id' => 'gr-001',
            'purchase_order_id' => 'po-001',
            'received_qty' => 95.0,
            'ordered_qty' => 100.0,
            'supplier_id' => 'sup-001',
        ];
    }

    // ── 1. Basic orchestration with GR builder (no recipe) ───────────────────

    public function test_orchestrator_returns_result_for_goods_receipt_context(): void
    {
        $this->registry->register('goods_receipt', new InMemoryRuleProvider($this->approveAllRule()));

        $result = $this->orchestrator->orchestrate(
            $this->trigger(),
            new GoodsReceiptContextBuilder,
            $this->grParams(),
        );

        $this->assertInstanceOf(OrchestratorResult::class, $result);
        $this->assertSame(DecisionType::Approve, $result->decision->decision);
        $this->assertFalse($result->hasRecipe());
        $this->assertNull($result->recipe_snapshot);
    }

    // ── 2. Resolver is NOT called for GR context ─────────────────────────────

    public function test_resolver_not_called_when_builder_does_not_require_recipe(): void
    {
        $this->resolver->expects($this->never())->method('resolve');
        $this->registry->register('goods_receipt', new InMemoryRuleProvider($this->approveAllRule()));

        $this->orchestrator->orchestrate($this->trigger(), new GoodsReceiptContextBuilder, $this->grParams());
    }

    // ── 3. Resolver IS called for manufacturing context ───────────────────────

    public function test_resolver_called_when_builder_requires_recipe(): void
    {
        $this->resolver
            ->expects($this->once())
            ->method('resolve')
            ->with('prod-001')
            ->willReturn($this->snapshot);

        $this->registry->register('manufacturing', new InMemoryRuleProvider($this->approveAllRule()));

        $this->orchestrator->orchestrate($this->trigger(), new ManufacturingContextBuilder, $this->mfgParams());
    }

    // ── 4. Recipe snapshot present in result when resolved ───────────────────

    public function test_result_contains_recipe_snapshot_when_resolved(): void
    {
        $this->resolver->method('resolve')->willReturn($this->snapshot);
        $this->registry->register('manufacturing', new InMemoryRuleProvider($this->approveAllRule()));

        $result = $this->orchestrator->orchestrate(
            $this->trigger(),
            new ManufacturingContextBuilder,
            $this->mfgParams(),
        );

        $this->assertTrue($result->hasRecipe());
        $this->assertSame($this->snapshot, $result->recipe_snapshot);
    }

    // ── 5. Context enriched with recipe metadata after resolution ─────────────

    public function test_context_enriched_with_recipe_metadata(): void
    {
        $this->resolver->method('resolve')->willReturn($this->snapshot);

        // Rule that checks recipe_id is present in context
        $recipeCheckRule = new DecisionRule(
            rule_id: 'recipe-check',
            name: 'Recipe Check',
            priority: 100,
            decision_type: DecisionType::Approve,
            reason: new DecisionReason('RECIPE_OK', 'Recipe data present.'),
            condition: fn (DecisionContext $ctx): bool => $ctx->has('recipe_id')
                && $ctx->has('bom_version_number')
                && $ctx->has('component_count')
                && $ctx->get('recipe_resolved') === true,
        );

        $this->registry->register('manufacturing', new InMemoryRuleProvider($recipeCheckRule));

        $result = $this->orchestrator->orchestrate(
            $this->trigger(),
            new ManufacturingContextBuilder,
            $this->mfgParams(),
        );

        // If enrichment worked, the rule matched → decision is APPROVE
        $this->assertTrue($result->decision->isApproved());
        $this->assertSame('recipe-001', $result->decision->context->get('recipe_id'));
        $this->assertSame(1, $result->decision->context->get('bom_version_number'));
        $this->assertSame(1, $result->decision->context->get('component_count'));
    }

    // ── 6. Rule provider selected by context type ─────────────────────────────

    public function test_orchestrator_selects_rule_provider_by_context_type(): void
    {
        $mfgRule = $this->approveAllRule('mfg-rule');
        $grRule = $this->rejectAllRule('gr-rule');

        $this->registry
            ->register('manufacturing', new InMemoryRuleProvider($mfgRule))
            ->register('goods_receipt', new InMemoryRuleProvider($grRule));

        $this->resolver->method('resolve')->willReturn($this->snapshot);

        $mfgResult = $this->orchestrator->orchestrate(
            $this->trigger(),
            new ManufacturingContextBuilder,
            $this->mfgParams(),
        );

        $grResult = $this->orchestrator->orchestrate(
            $this->trigger(),
            new GoodsReceiptContextBuilder,
            $this->grParams(),
        );

        $this->assertSame(DecisionType::Approve, $mfgResult->decision->decision);
        $this->assertSame(DecisionType::Reject, $grResult->decision->decision);
    }

    // ── 7. OrchestratorResult contains DecisionResult ────────────────────────

    public function test_result_contains_decision_result(): void
    {
        $this->registry->register('goods_receipt', new InMemoryRuleProvider($this->approveAllRule()));

        $result = $this->orchestrator->orchestrate(
            $this->trigger(),
            new GoodsReceiptContextBuilder,
            $this->grParams(),
        );

        $this->assertNotNull($result->decision);
        $this->assertSame(DecisionType::Approve, $result->decision->decision);
        $this->assertSame('goods_receipt', $result->decision->context->context_type);
    }

    // ── 8. Metadata propagated into result ────────────────────────────────────

    public function test_caller_metadata_propagated_into_orchestrator_result(): void
    {
        $this->registry->register('goods_receipt', new InMemoryRuleProvider($this->approveAllRule()));

        $result = $this->orchestrator->orchestrate(
            $this->trigger(),
            new GoodsReceiptContextBuilder,
            $this->grParams(),
            ['source' => 'api', 'request_id' => 'req-xyz'],
        );

        $this->assertSame('api', $result->metadata['source']);
        $this->assertSame('req-xyz', $result->metadata['request_id']);
    }

    // ── 9. Metadata always includes context_type ──────────────────────────────

    public function test_metadata_always_includes_context_type(): void
    {
        $this->registry->register('goods_receipt', new InMemoryRuleProvider($this->approveAllRule()));

        $result = $this->orchestrator->orchestrate(
            $this->trigger(),
            new GoodsReceiptContextBuilder,
            $this->grParams(),
        );

        $this->assertSame('goods_receipt', $result->metadata['context_type']);
    }

    // ── 10. Metadata includes recipe fields when recipe resolved ─────────────

    public function test_metadata_includes_recipe_fields_when_snapshot_resolved(): void
    {
        $this->resolver->method('resolve')->willReturn($this->snapshot);
        $this->registry->register('manufacturing', new InMemoryRuleProvider($this->approveAllRule()));

        $result = $this->orchestrator->orchestrate(
            $this->trigger(),
            new ManufacturingContextBuilder,
            $this->mfgParams(),
        );

        $this->assertSame('recipe-001', $result->metadata['recipe_id']);
        $this->assertSame(1, $result->metadata['bom_version_number']);
    }

    // ── 11. Exception: recipe resolver exception propagates ───────────────────

    public function test_propagates_recipe_resolver_exception(): void
    {
        $this->resolver
            ->method('resolve')
            ->willThrowException(RecipeResolverException::noActiveRecipe('prod-001'));

        $this->registry->register('manufacturing', new InMemoryRuleProvider($this->approveAllRule()));

        $this->expectException(RecipeResolverException::class);

        $this->orchestrator->orchestrate(
            $this->trigger(),
            new ManufacturingContextBuilder,
            $this->mfgParams(),
        );
    }

    // ── 12. Exception: no matching rule propagates ───────────────────────────

    public function test_propagates_no_matching_rule_exception(): void
    {
        $neverMatches = new DecisionRule(
            rule_id: 'never',
            name: 'Never Matches',
            priority: 1,
            decision_type: DecisionType::Approve,
            reason: new DecisionReason('NEVER', 'Never fires.'),
            condition: fn ($ctx): bool => false,
        );

        $this->registry->register('goods_receipt', new InMemoryRuleProvider($neverMatches));

        $this->expectException(NoMatchingRuleException::class);

        $this->orchestrator->orchestrate(
            $this->trigger(),
            new GoodsReceiptContextBuilder,
            $this->grParams(),
        );
    }

    // ── 13. Exception: no provider for context type ───────────────────────────

    public function test_throws_no_provider_when_context_type_not_registered(): void
    {
        // No provider registered for 'goods_receipt'
        $this->expectException(NoProviderForContextException::class);

        try {
            $this->orchestrator->orchestrate(
                $this->trigger(),
                new GoodsReceiptContextBuilder,
                $this->grParams(),
            );
        } catch (NoProviderForContextException $e) {
            $this->assertSame('goods_receipt', $e->contextType());
            throw $e;
        }
    }

    // ── 14. Exception: missing product_id when recipe required ────────────────

    public function test_throws_when_product_id_missing_and_recipe_required(): void
    {
        $this->registry->register('manufacturing', new InMemoryRuleProvider($this->approveAllRule()));

        $params = $this->mfgParams();
        unset($params['product_id']); // deliberately missing

        $this->expectException(OrchestratorException::class);

        try {
            $this->orchestrator->orchestrate($this->trigger(), new ManufacturingContextBuilder, $params);
        } catch (OrchestratorException $e) {
            $this->assertSame(OrchestratorException::MISSING_PRODUCT_ID, $e->reason());
            throw $e;
        }
    }

    // ── 15. OrchestratorResult is immutable ──────────────────────────────────

    public function test_orchestrator_result_is_immutable(): void
    {
        $this->registry->register('goods_receipt', new InMemoryRuleProvider($this->approveAllRule()));

        $result = $this->orchestrator->orchestrate(
            $this->trigger(),
            new GoodsReceiptContextBuilder,
            $this->grParams(),
        );

        $this->expectException(Error::class);

        // @phpstan-ignore-next-line
        $result->decision = null;
    }

    // ── 16. OrchestratorResult.toArray() has all keys ─────────────────────────

    public function test_orchestrator_result_to_array_contains_all_keys(): void
    {
        $this->registry->register('goods_receipt', new InMemoryRuleProvider($this->approveAllRule()));

        $arr = $this->orchestrator->orchestrate(
            $this->trigger(),
            new GoodsReceiptContextBuilder,
            $this->grParams(),
        )->toArray();

        $this->assertArrayHasKey('decision', $arr);
        $this->assertArrayHasKey('recipe_snapshot', $arr);
        $this->assertArrayHasKey('metadata', $arr);
        $this->assertNull($arr['recipe_snapshot']); // no recipe for GR
    }

    // ── 17. ManufacturingContextBuilder — context type ───────────────────────

    public function test_manufacturing_context_builder_produces_correct_context_type(): void
    {
        $builder = new ManufacturingContextBuilder;
        $ctx = $builder->build($this->mfgParams());

        $this->assertSame('manufacturing', $ctx->context_type);
        $this->assertSame('manufacturing', $builder->contextType());
    }

    // ── 18. ManufacturingContextBuilder — sets shortage_qty ──────────────────

    public function test_manufacturing_context_builder_sets_shortage_qty(): void
    {
        $builder = new ManufacturingContextBuilder;
        $ctx = $builder->build([
            'product_id' => 'prod-001',
            'ordered_qty' => 10.0,
            'available_qty' => 3.0,
            'shortage_qty' => 7.0,
        ]);

        $this->assertSame(10.0, $ctx->get('ordered_qty'));
        $this->assertSame(3.0, $ctx->get('available_qty'));
        $this->assertSame(7.0, $ctx->get('shortage_qty'));
        $this->assertSame('prod-001', $ctx->get('product_id'));
    }

    // ── 19. ManufacturingContextBuilder — requiresRecipe ─────────────────────

    public function test_manufacturing_context_builder_requires_recipe(): void
    {
        $this->assertTrue((new ManufacturingContextBuilder)->requiresRecipe());
    }

    // ── 20. GoodsReceiptContextBuilder — context type ────────────────────────

    public function test_goods_receipt_context_builder_produces_correct_context_type(): void
    {
        $builder = new GoodsReceiptContextBuilder;
        $ctx = $builder->build($this->grParams());

        $this->assertSame('goods_receipt', $ctx->context_type);
        $this->assertSame('goods_receipt', $builder->contextType());
    }

    // ── 21. GoodsReceiptContextBuilder — does not require recipe ─────────────

    public function test_goods_receipt_context_builder_does_not_require_recipe(): void
    {
        $this->assertFalse((new GoodsReceiptContextBuilder)->requiresRecipe());
    }

    // ── 22. GoodsReceiptContextBuilder — computes variance_pct ───────────────

    public function test_goods_receipt_context_builder_computes_variance_pct(): void
    {
        $ctx = (new GoodsReceiptContextBuilder)->build([
            'gr_id' => 'gr-001',
            'purchase_order_id' => 'po-001',
            'received_qty' => 90.0,
            'ordered_qty' => 100.0,
            'supplier_id' => 'sup-001',
        ]);

        $this->assertSame(10.0, $ctx->get('variance_pct'));
        $this->assertTrue($ctx->get('is_partial'));
        $this->assertFalse($ctx->get('over_received'));
    }

    // ── 23. InMemoryRuleProviderRegistry — register and retrieve ─────────────

    public function test_in_memory_registry_registers_and_retrieves_provider(): void
    {
        $provider = new InMemoryRuleProvider($this->approveAllRule());
        $this->registry->register('my_type', $provider);

        $this->assertTrue($this->registry->has('my_type'));
        $this->assertSame($provider, $this->registry->for('my_type'));
    }

    // ── 24. InMemoryRuleProviderRegistry — throws for unknown ────────────────

    public function test_in_memory_registry_throws_for_unknown_context_type(): void
    {
        $this->expectException(NoProviderForContextException::class);

        try {
            $this->registry->for('unknown_type');
        } catch (NoProviderForContextException $e) {
            $this->assertSame('unknown_type', $e->contextType());
            throw $e;
        }
    }

    // ── 25. InMemoryRuleProviderRegistry — has returns false ─────────────────

    public function test_in_memory_registry_has_returns_false_for_unknown(): void
    {
        $this->assertFalse($this->registry->has('not_registered'));
    }
}
