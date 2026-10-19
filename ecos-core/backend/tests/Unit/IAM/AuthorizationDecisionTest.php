<?php

declare(strict_types=1);

namespace Tests\Unit\IAM;

use Error;
use Modules\IAM\Domain\ValueObjects\AuthorizationDecision;
use PHPUnit\Framework\TestCase;

/**
 * TASK-IAM-002 Phase 1 — AuthorizationDecision immutable value object.
 */
class AuthorizationDecisionTest extends TestCase
{
    public function test_allow_factory(): void
    {
        $d = AuthorizationDecision::allow('inventory.products.view', 'inventory.products.view', 'warehouse-manager', 'granted');

        $this->assertTrue($d->isAllowed());
        $this->assertFalse($d->isDenied());
        $this->assertSame('inventory.products.view', $d->permission);
        $this->assertSame('inventory.products.view', $d->matchedPermission);
        $this->assertSame('warehouse-manager', $d->matchedRole);
        $this->assertSame('granted', $d->reason());
    }

    public function test_deny_factory(): void
    {
        $d = AuthorizationDecision::deny('inventory.products.delete', 'not granted');

        $this->assertTrue($d->isDenied());
        $this->assertFalse($d->isAllowed());
        $this->assertNull($d->matchedPermission);
        $this->assertNull($d->matchedRole);
        $this->assertSame('not granted', $d->reason());
    }

    public function test_composition_fields_default_null(): void
    {
        $d = AuthorizationDecision::allow('inventory.products.view');

        $this->assertNull($d->hiddenFields);   // Visibility
        $this->assertNull($d->matchedScope);   // Data Scope
        $this->assertNull($d->matchedPolicy);  // Policy
    }

    public function test_with_methods_compose_immutably(): void
    {
        $base = AuthorizationDecision::allow('inventory.products.view');

        $enriched = $base
            ->withHiddenFields(['average_cost'])
            ->withScope('branch')
            ->withPolicy('order.window');

        // Original untouched (immutability).
        $this->assertNull($base->hiddenFields);
        $this->assertNull($base->matchedScope);

        // Enriched copy carries the new data.
        $this->assertSame(['average_cost'], $enriched->hiddenFields);
        $this->assertSame('branch', $enriched->matchedScope);
        $this->assertSame('order.window', $enriched->matchedPolicy);
        $this->assertTrue($enriched->isAllowed());

        // deniedBecause flips a composed decision to a deny with an audit reason.
        $denied = $enriched->deniedBecause('period not balanced', 'policy');
        $this->assertTrue($denied->isDenied());
        $this->assertSame('policy', $denied->source);
        $this->assertSame('period not balanced', $denied->reason());
    }

    public function test_is_immutable(): void
    {
        $d = AuthorizationDecision::allow('inventory.products.view');

        $this->expectException(Error::class); // readonly property write → Error
        // @phpstan-ignore-next-line intentional immutability probe
        $d->allowed = false;
    }

    public function test_to_array_shape(): void
    {
        $d = AuthorizationDecision::allow('inventory.products.view', 'inventory.products.view', 'ceo', 'ok');
        $array = $d->toArray();

        // Stable fields.
        $this->assertSame(true, $array['allowed']);
        $this->assertSame('inventory.products.view', $array['permission']);
        $this->assertSame('inventory.products.view', $array['matched_permission']);
        $this->assertSame('ceo', $array['matched_role']);
        $this->assertSame('ok', $array['reason']);
        $this->assertNull($array['matched_scope']);
        $this->assertNull($array['matched_policy']);
        $this->assertNull($array['hidden_fields']);

        // Audit fields present.
        $this->assertArrayHasKey('decided_at', $array);
        $this->assertSame('authorization', $array['source']);
    }
}
