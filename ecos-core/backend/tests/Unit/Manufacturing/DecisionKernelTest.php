<?php

declare(strict_types=1);

namespace Tests\Unit\Manufacturing;

use Error;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\Exceptions\NoMatchingRuleException;
use Modules\Manufacturing\DecisionKernel\Domain\Services\DecisionKernel;
use Modules\Manufacturing\DecisionKernel\Domain\Services\InMemoryRuleProvider;
use Modules\Manufacturing\DecisionKernel\Domain\Services\RuleEvaluationPipeline;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionEvaluation;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionResult;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionRule;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionTrigger;
use PHPUnit\Framework\TestCase;

/**
 * PKG-03A: Decision Kernel unit tests.
 *
 * Pure unit tests — no database, no Laravel boot, no infrastructure.
 * All dependencies are constructed directly (no container).
 */
class DecisionKernelTest extends TestCase
{
    private DecisionKernel $kernel;

    protected function setUp(): void
    {
        parent::setUp();
        $this->kernel = new DecisionKernel(new RuleEvaluationPipeline);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function rule(
        string $name,
        int $priority,
        DecisionType $type,
        bool $matches = true,
        string $ruleId = '',
        array $metadata = [],
    ): DecisionRule {
        return new DecisionRule(
            rule_id: $ruleId ?: uniqid('rule_'),
            name: $name,
            priority: $priority,
            decision_type: $type,
            reason: new DecisionReason("{$type->value}_reason", "Rule [{$name}] fired."),
            condition: fn (DecisionContext $ctx): bool => $matches,
            metadata: $metadata,
        );
    }

    private function trigger(string $type = 'TEST_TRIGGER', string $id = 'test-001'): DecisionTrigger
    {
        return DecisionTrigger::now($type, $id);
    }

    private function context(string $type = 'test', array $data = []): DecisionContext
    {
        $ctx = new DecisionContext($type);
        foreach ($data as $k => $v) {
            $ctx = $ctx->with($k, $v);
        }

        return $ctx;
    }

    private function provider(DecisionRule ...$rules): InMemoryRuleProvider
    {
        return new InMemoryRuleProvider(...$rules);
    }

    // ── 1. Happy path — approve ───────────────────────────────────────────────

    public function test_kernel_returns_approved_result_for_approve_rule(): void
    {
        $rule = $this->rule('approve-all', 100, DecisionType::Approve);
        $result = $this->kernel->evaluate($this->trigger(), $this->context(), $this->provider($rule));

        $this->assertInstanceOf(DecisionResult::class, $result);
        $this->assertSame(DecisionType::Approve, $result->decision);
        $this->assertTrue($result->isApproved());
    }

    // ── 2. Happy path — reject ────────────────────────────────────────────────

    public function test_kernel_returns_rejected_result_for_reject_rule(): void
    {
        $rule = $this->rule('reject-all', 50, DecisionType::Reject);
        $result = $this->kernel->evaluate($this->trigger(), $this->context(), $this->provider($rule));

        $this->assertSame(DecisionType::Reject, $result->decision);
        $this->assertTrue($result->isRejected());
        $this->assertFalse($result->isApproved());
    }

    // ── 3. Happy path — defer ─────────────────────────────────────────────────

    public function test_kernel_returns_deferred_result_for_defer_rule(): void
    {
        $rule = $this->rule('defer-all', 10, DecisionType::Defer);
        $result = $this->kernel->evaluate($this->trigger(), $this->context(), $this->provider($rule));

        $this->assertSame(DecisionType::Defer, $result->decision);
        $this->assertTrue($result->isDeferred());
    }

    // ── 4. Exception: no matching rule ────────────────────────────────────────

    public function test_kernel_throws_when_no_rule_matches(): void
    {
        $nonMatching = $this->rule('never-fires', 100, DecisionType::Approve, matches: false);

        $this->expectException(NoMatchingRuleException::class);

        try {
            $this->kernel->evaluate($this->trigger(), $this->context('procurement'), $this->provider($nonMatching));
        } catch (NoMatchingRuleException $e) {
            $this->assertSame('procurement', $e->contextType());
            throw $e;
        }
    }

    // ── 5. Exception: empty rule list ─────────────────────────────────────────

    public function test_kernel_throws_when_rule_list_is_empty(): void
    {
        $this->expectException(NoMatchingRuleException::class);

        $this->kernel->evaluate($this->trigger(), $this->context('empty'), $this->provider());
    }

    // ── 6. Priority — highest wins ────────────────────────────────────────────

    public function test_kernel_selects_highest_priority_when_multiple_rules_match(): void
    {
        $low = $this->rule('low', 10, DecisionType::Reject, ruleId: 'r-low');
        $high = $this->rule('high', 99, DecisionType::Approve, ruleId: 'r-high');
        $medium = $this->rule('mid', 50, DecisionType::Defer, ruleId: 'r-mid');

        $result = $this->kernel->evaluate(
            $this->trigger(),
            $this->context(),
            $this->provider($low, $high, $medium),
        );

        $this->assertSame(DecisionType::Approve, $result->decision);
        $this->assertSame('r-high', $result->matched_rule->rule_id);
    }

    // ── 7. Priority tie — first registered wins ───────────────────────────────

    public function test_kernel_picks_first_registered_rule_on_priority_tie(): void
    {
        $first = $this->rule('first', 50, DecisionType::Approve, ruleId: 'r-first');
        $second = $this->rule('second', 50, DecisionType::Reject, ruleId: 'r-second');

        $result = $this->kernel->evaluate(
            $this->trigger(),
            $this->context(),
            $this->provider($first, $second),
        );

        $this->assertSame('r-first', $result->matched_rule->rule_id);
        $this->assertSame(DecisionType::Approve, $result->decision);
    }

    // ── 8. Result carries trigger ─────────────────────────────────────────────

    public function test_kernel_result_contains_correct_trigger(): void
    {
        $rule = $this->rule('ok', 1, DecisionType::Approve);
        $trigger = $this->trigger('ORDER_PLACEMENT', 'order-uuid-123');
        $result = $this->kernel->evaluate($trigger, $this->context(), $this->provider($rule));

        $this->assertSame('ORDER_PLACEMENT', $result->trigger->trigger_type);
        $this->assertSame('order-uuid-123', $result->trigger->trigger_id);
    }

    // ── 9. Result carries context ─────────────────────────────────────────────

    public function test_kernel_result_contains_correct_context(): void
    {
        $rule = $this->rule('ok', 1, DecisionType::Approve);
        $context = $this->context('manufacturing', ['shortage_qty' => 5, 'product_id' => 'prod-001']);
        $result = $this->kernel->evaluate($this->trigger(), $context, $this->provider($rule));

        $this->assertSame('manufacturing', $result->context->context_type);
        $this->assertSame(5, $result->context->get('shortage_qty'));
        $this->assertSame('prod-001', $result->context->get('product_id'));
    }

    // ── 10. Result carries matched rule evaluation ────────────────────────────

    public function test_kernel_result_contains_matched_rule_evaluation(): void
    {
        $rule = $this->rule('specific-rule', 77, DecisionType::Partial, ruleId: 'r-specific');
        $result = $this->kernel->evaluate($this->trigger(), $this->context(), $this->provider($rule));

        $this->assertInstanceOf(DecisionEvaluation::class, $result->matched_rule);
        $this->assertSame('r-specific', $result->matched_rule->rule_id);
        $this->assertSame('specific-rule', $result->matched_rule->rule_name);
        $this->assertSame(77, $result->matched_rule->priority);
        $this->assertTrue($result->matched_rule->matched);
    }

    // ── 11. decided_at is ISO 8601 ────────────────────────────────────────────

    public function test_kernel_result_decided_at_is_iso8601_string(): void
    {
        $rule = $this->rule('ok', 1, DecisionType::Approve);
        $result = $this->kernel->evaluate($this->trigger(), $this->context(), $this->provider($rule));

        $this->assertNotEmpty($result->decided_at);
        $this->assertNotFalse(strtotime($result->decided_at));
        // ISO 8601 / RFC 3339 format contains 'T' separator
        $this->assertStringContainsString('T', $result->decided_at);
    }

    // ── 12. Result is immutable ───────────────────────────────────────────────

    public function test_kernel_result_is_immutable_readonly_class(): void
    {
        $rule = $this->rule('ok', 1, DecisionType::Approve);
        $result = $this->kernel->evaluate($this->trigger(), $this->context(), $this->provider($rule));

        $this->expectException(Error::class);

        // @phpstan-ignore-next-line
        $result->decision = DecisionType::Reject;
    }

    // ── 13. Snapshot fields default to null ──────────────────────────────────

    public function test_kernel_result_snapshot_fields_default_to_null(): void
    {
        $rule = $this->rule('ok', 1, DecisionType::Approve);
        $result = $this->kernel->evaluate($this->trigger(), $this->context(), $this->provider($rule));

        $this->assertNull($result->snapshot_id);
        $this->assertNull($result->snapshot_hash);
    }

    // ── 14. Helper: isApproved ────────────────────────────────────────────────

    public function test_decision_result_is_approved_helper(): void
    {
        $result = $this->kernel->evaluate(
            $this->trigger(),
            $this->context(),
            $this->provider($this->rule('ok', 1, DecisionType::Approve)),
        );

        $this->assertTrue($result->isApproved());
        $this->assertFalse($result->isRejected());
        $this->assertFalse($result->isDeferred());
        $this->assertFalse($result->isPartial());
        $this->assertFalse($result->isEscalated());
    }

    // ── 15. Helper: isRejected ────────────────────────────────────────────────

    public function test_decision_result_is_rejected_helper(): void
    {
        $result = $this->kernel->evaluate(
            $this->trigger(),
            $this->context(),
            $this->provider($this->rule('no', 1, DecisionType::Reject)),
        );

        $this->assertTrue($result->isRejected());
        $this->assertFalse($result->isApproved());
    }

    // ── 16. toArray serialization ─────────────────────────────────────────────

    public function test_decision_result_to_array_contains_all_keys(): void
    {
        $rule = $this->rule('ok', 1, DecisionType::Approve);
        $arr = $this->kernel->evaluate($this->trigger(), $this->context(), $this->provider($rule))->toArray();

        $this->assertArrayHasKey('decision', $arr);
        $this->assertArrayHasKey('reason', $arr);
        $this->assertArrayHasKey('matched_rule', $arr);
        $this->assertArrayHasKey('context', $arr);
        $this->assertArrayHasKey('trigger', $arr);
        $this->assertArrayHasKey('decided_at', $arr);
        $this->assertArrayHasKey('metadata', $arr);
        $this->assertArrayHasKey('snapshot_id', $arr);
        $this->assertArrayHasKey('snapshot_hash', $arr);
    }

    // ── 17. DecisionContext — with() immutable builder ────────────────────────

    public function test_decision_context_with_creates_new_immutable_instance(): void
    {
        $original = new DecisionContext('test');
        $enriched = $original->with('key', 'value');

        $this->assertNotSame($original, $enriched);
        $this->assertFalse($original->has('key'));
        $this->assertTrue($enriched->has('key'));
        $this->assertSame('value', $enriched->get('key'));
    }

    // ── 18. DecisionContext — get default ─────────────────────────────────────

    public function test_decision_context_get_returns_default_for_missing_key(): void
    {
        $ctx = new DecisionContext('test');

        $this->assertNull($ctx->get('missing'));
        $this->assertSame('fallback', $ctx->get('missing', 'fallback'));
        $this->assertSame(0, $ctx->get('missing', 0));
    }

    // ── 19. DecisionContext — has ─────────────────────────────────────────────

    public function test_decision_context_has_returns_true_for_existing_key(): void
    {
        $ctx = (new DecisionContext('test'))->with('x', null);

        // has() checks existence, not truthiness — null values should return true
        $this->assertTrue($ctx->has('x'));
        $this->assertFalse($ctx->has('y'));
    }

    // ── 20. DecisionContext — all ─────────────────────────────────────────────

    public function test_decision_context_all_returns_all_data(): void
    {
        $ctx = (new DecisionContext('mfg'))
            ->with('a', 1)
            ->with('b', 'hello');

        $this->assertSame(['a' => 1, 'b' => 'hello'], $ctx->all());
    }

    // ── 21. DecisionTrigger — all fields ─────────────────────────────────────

    public function test_decision_trigger_captures_all_fields(): void
    {
        $trigger = DecisionTrigger::now('ORDER_PLACEMENT', 'order-abc', 3, 'user-007', ['source' => 'api']);

        $this->assertSame('ORDER_PLACEMENT', $trigger->trigger_type);
        $this->assertSame('order-abc', $trigger->trigger_id);
        $this->assertSame(3, $trigger->trigger_version);
        $this->assertSame('user-007', $trigger->actor_id);
        $this->assertSame(['source' => 'api'], $trigger->metadata);
        $this->assertNotFalse(strtotime($trigger->triggered_at));
    }

    // ── 22. DecisionReason ────────────────────────────────────────────────────

    public function test_decision_reason_captures_code_and_message(): void
    {
        $reason = new DecisionReason('INSUFFICIENT_STOCK', 'Not enough stock.', ['needed' => 5, 'available' => 2]);

        $this->assertSame('INSUFFICIENT_STOCK', $reason->code);
        $this->assertSame('Not enough stock.', $reason->message);
        $this->assertSame(5, $reason->context['needed']);

        $arr = $reason->toArray();
        $this->assertArrayHasKey('code', $arr);
        $this->assertArrayHasKey('message', $arr);
        $this->assertArrayHasKey('context', $arr);
    }

    // ── 23. DecisionRule — matches true ──────────────────────────────────────

    public function test_decision_rule_matches_returns_true_when_condition_met(): void
    {
        $rule = new DecisionRule(
            rule_id: 'r1',
            name: 'stock-ok',
            priority: 10,
            decision_type: DecisionType::Approve,
            reason: new DecisionReason('OK', 'Stock available.'),
            condition: fn (DecisionContext $ctx): bool => $ctx->get('qty', 0) > 0,
        );

        $ctx = (new DecisionContext('test'))->with('qty', 5);

        $this->assertTrue($rule->matches($ctx));
    }

    // ── 24. DecisionRule — matches false ─────────────────────────────────────

    public function test_decision_rule_matches_returns_false_when_condition_not_met(): void
    {
        $rule = new DecisionRule(
            rule_id: 'r2',
            name: 'stock-check',
            priority: 10,
            decision_type: DecisionType::Reject,
            reason: new DecisionReason('NO_STOCK', 'Out of stock.'),
            condition: fn (DecisionContext $ctx): bool => $ctx->get('qty', 0) > 0,
        );

        $ctx = (new DecisionContext('test'))->with('qty', 0);

        $this->assertFalse($rule->matches($ctx));
    }

    // ── 25. DecisionType enum ─────────────────────────────────────────────────

    public function test_decision_type_has_all_expected_cases(): void
    {
        $cases = array_map(fn (DecisionType $t) => $t->value, DecisionType::cases());

        $this->assertContains('approve', $cases);
        $this->assertContains('reject', $cases);
        $this->assertContains('defer', $cases);
        $this->assertContains('partial', $cases);
        $this->assertContains('escalate', $cases);
        $this->assertCount(5, $cases);
    }

    // ── 26. InMemoryRuleProvider ──────────────────────────────────────────────

    public function test_in_memory_rule_provider_returns_all_rules(): void
    {
        $r1 = $this->rule('a', 1, DecisionType::Approve, ruleId: 'r-a');
        $r2 = $this->rule('b', 2, DecisionType::Reject, ruleId: 'r-b');
        $r3 = $this->rule('c', 3, DecisionType::Defer, ruleId: 'r-c');

        $provider = new InMemoryRuleProvider($r1, $r2, $r3);

        $this->assertCount(3, $provider->rules());
    }

    // ── 27. NoMatchingRuleException ───────────────────────────────────────────

    public function test_no_matching_rule_exception_carries_context_type(): void
    {
        $e = NoMatchingRuleException::forContext('ai_recommendation');

        $this->assertSame('ai_recommendation', $e->contextType());
        $this->assertStringContainsString('ai_recommendation', $e->getMessage());
    }

    // ── 28. DecisionEvaluation — all fields ───────────────────────────────────

    public function test_decision_evaluation_captures_all_fields(): void
    {
        $reason = new DecisionReason('TEST', 'Test reason.');
        $eval = new DecisionEvaluation(
            rule_id: 'eval-rule-1',
            rule_name: 'Eval Rule',
            priority: 42,
            matched: true,
            decision_type: DecisionType::Escalate,
            reason: $reason,
            metadata: ['key' => 'val'],
        );

        $this->assertSame('eval-rule-1', $eval->rule_id);
        $this->assertSame('Eval Rule', $eval->rule_name);
        $this->assertSame(42, $eval->priority);
        $this->assertTrue($eval->matched);
        $this->assertSame(DecisionType::Escalate, $eval->decision_type);

        $arr = $eval->toArray();
        $this->assertArrayHasKey('rule_id', $arr);
        $this->assertArrayHasKey('decision_type', $arr);
        $this->assertArrayHasKey('reason', $arr);
        $this->assertArrayHasKey('metadata', $arr);
    }
}
