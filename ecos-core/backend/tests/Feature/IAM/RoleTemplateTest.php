<?php

declare(strict_types=1);

namespace Tests\Feature\IAM;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\IAM\Application\Services\RoleComparisonService;
use Modules\IAM\Application\Services\RolePreviewService;
use Modules\IAM\Application\Services\RoleTemplateExportService;
use Modules\IAM\Application\Services\RoleTemplateImportService;
use Modules\IAM\Application\Services\RoleTemplateVersionService;
use Modules\IAM\Domain\Contracts\RoleCompositionInterface;
use Modules\IAM\Domain\Contracts\RoleTemplateRepositoryInterface;
use Modules\IAM\Domain\Enums\RoleCategory;
use Modules\IAM\Domain\Enums\RoleTemplateStatus;
use Modules\IAM\Domain\Exceptions\RoleTemplateImportException;
use Modules\IAM\Domain\Exceptions\SystemTemplateImmutableException;
use Modules\IAM\Domain\Models\RoleTemplate;
use Modules\IAM\Domain\Models\RoleTemplateVersion;
use Modules\IAM\Infrastructure\Database\Seeders\RoleTemplateSeeder;
use Tests\TestCase;

/**
 * TASK-IAM-003 — Enterprise Role Templates (ADR-039).
 */
class RoleTemplateTest extends TestCase
{
    use RefreshDatabase;

    private function repository(): RoleTemplateRepositoryInterface
    {
        return app(RoleTemplateRepositoryInterface::class);
    }

    /** Call run() directly so exceptions propagate (unlike $this->seed(), which swallows them). */
    private function seedTemplates(): void
    {
        $this->app->make(RoleTemplateSeeder::class)->run();
    }

    private function makeCustom(string $key, array $definition, string $category = 'custom'): RoleTemplate
    {
        return $this->repository()->createCustom([
            'key' => $key,
            'name' => ucfirst($key),
            'category' => $category,
            'definition' => $definition,
        ]);
    }

    // ── Library seeding ───────────────────────────────────────────────────────

    public function test_seeds_the_40_official_system_templates(): void
    {
        $this->seedTemplates();

        $this->assertSame(40, RoleTemplate::where('is_system', true)->count());
        $ceo = $this->repository()->findByKey('ceo');
        $this->assertNotNull($ceo);
        $this->assertTrue($ceo->is_system);
        $this->assertSame(RoleCategory::EXECUTIVE->value, $ceo->category);
        $this->assertSame(RoleTemplateStatus::PUBLISHED->value, $ceo->status);
    }

    public function test_seeder_is_idempotent(): void
    {
        $this->seedTemplates();
        $this->seedTemplates();

        $this->assertSame(40, RoleTemplate::where('is_system', true)->count());
        // Version stays at 1 — nothing changed on the second run.
        $this->assertSame(1, $this->repository()->findByKey('warehouse-clerk')->version);
        // Exactly one version snapshot per template.
        $this->assertSame(40, RoleTemplateVersion::count());
    }

    // ── System protection ─────────────────────────────────────────────────────

    public function test_system_templates_cannot_be_updated(): void
    {
        $this->seedTemplates();
        $ceo = $this->repository()->findByKey('ceo');

        $this->expectException(SystemTemplateImmutableException::class);
        $this->repository()->update($ceo, ['name' => 'Hacked']);
    }

    public function test_system_templates_cannot_be_deleted(): void
    {
        $this->seedTemplates();

        $this->expectException(SystemTemplateImmutableException::class);
        $this->repository()->delete($this->repository()->findByKey('ceo'));
    }

    public function test_cloning_a_system_template_produces_an_editable_custom(): void
    {
        $this->seedTemplates();
        $clone = $this->repository()->clone($this->repository()->findByKey('warehouse-clerk'), 'night-clerk', 'Night Clerk');

        $this->assertFalse($clone->is_system);
        $this->assertSame(RoleTemplateStatus::DRAFT->value, $clone->status);
        $this->assertSame(1, $clone->version);
        $this->assertNull($clone->role_id);
        // The clone is now freely editable.
        $updated = $this->repository()->update($clone, ['name' => 'Night Warehouse Clerk']);
        $this->assertSame('Night Warehouse Clerk', $updated->name);
        $this->assertSame(2, $updated->version);
    }

    // ── Versioning ────────────────────────────────────────────────────────────

    public function test_updating_a_custom_template_appends_a_version_and_never_overwrites(): void
    {
        $tpl = $this->makeCustom('temp-role', ['permissions' => ['inventory.products.view']]);
        $this->assertSame(1, $tpl->version);

        $this->repository()->update($tpl, ['definition' => ['permissions' => ['inventory.products.view', 'inventory.products.create']]], 'added create');
        $this->repository()->update($tpl->refresh(), ['name' => 'Temp Role v3']);

        $versions = app(RoleTemplateVersionService::class)->history($tpl->refresh());
        $this->assertSame([3, 2, 1], $versions->pluck('version')->all());
        // v1 snapshot still holds the original definition — history is immutable.
        $v1 = app(RoleTemplateVersionService::class)->versionAt($tpl, 1);
        $this->assertSame(['inventory.products.view'], $v1->definition['permissions']);
    }

    // ── Composition + conflict resolution ─────────────────────────────────────

    public function test_composition_unions_permissions_and_takes_widest_scope(): void
    {
        $rep = $this->makeCustom('rep', [
            'permissions' => ['sales.orders.view', 'sales.orders.create'],
            'scopes' => ['sales.orders' => 'self'],
            'visibility' => ['hidden_fields' => ['cost', 'margin']],
        ], 'sales');
        $clerk = $this->makeCustom('clerk', [
            'permissions' => ['inventory.products.view'],
            'scopes' => ['sales.orders' => 'team'],
            'visibility' => ['hidden_fields' => ['cost']],
        ], 'warehouse');

        $profile = app(RoleCompositionInterface::class)->compose([$rep, $clerk]);

        // Permission union.
        $this->assertContains('sales.orders.view', $profile->permissions);
        $this->assertContains('inventory.products.view', $profile->permissions);
        // Widest scope wins: self vs team → team.
        $this->assertSame('team', $profile->scopeFor('sales.orders'));
        // Visibility intersection: only 'cost' is hidden by BOTH → 'margin' becomes visible.
        $this->assertContains('cost', $profile->hiddenFields);
        $this->assertNotContains('margin', $profile->hiddenFields);
    }

    public function test_explicit_deny_overrides_a_grant_in_composition(): void
    {
        $a = $this->makeCustom('grantor', ['permissions' => ['finance.periods.close']]);
        $b = $this->makeCustom('denier', ['permissions' => [], 'deny' => ['finance.periods.close']]);

        $profile = app(RoleCompositionInterface::class)->compose([$a, $b]);

        $this->assertNotContains('finance.periods.close', $profile->permissions);
    }

    public function test_wildcards_expand_against_the_permission_catalog(): void
    {
        $tpl = $this->makeCustom('inv-admin', ['permissions' => ['inventory.*']]);

        $profile = app(RolePreviewService::class)->preview($tpl);

        // Every expanded name is a concrete inventory permission (no wildcard survives).
        $this->assertNotContains('inventory.*', $profile->permissions);
        $this->assertNotEmpty($profile->permissions);
        foreach ($profile->permissions as $name) {
            $this->assertStringStartsWith('inventory.', $name);
        }
    }

    // ── Preview ───────────────────────────────────────────────────────────────

    public function test_preview_by_keys_composes_without_assignment(): void
    {
        $this->makeCustom('primary', ['permissions' => ['sales.orders.view'], 'landing_page' => 'orders', 'navigation' => ['modules' => ['commerce']]]);
        $this->makeCustom('secondary', ['permissions' => ['inventory.products.view'], 'landing_page' => 'inventoryDashboard', 'navigation' => ['modules' => ['inventory']]]);

        $profile = app(RolePreviewService::class)->previewByKeys(['primary', 'secondary']);

        // Navigation union, primary landing wins.
        $this->assertEqualsCanonicalizing(['commerce', 'inventory'], $profile->navigation);
        $this->assertSame('orders', $profile->landingPage);
    }

    // ── Comparison ────────────────────────────────────────────────────────────

    public function test_comparison_reports_differences(): void
    {
        $a = $this->makeCustom('lite', ['permissions' => ['sales.orders.view']]);
        $b = $this->makeCustom('full', ['permissions' => ['sales.orders.view', 'sales.orders.delete'], 'policies' => ['discount-approval']]);

        $diff = app(RoleComparisonService::class)->compare($a, $b);

        $this->assertFalse($diff->isIdentical());
        $this->assertContains('sales.orders.delete', $diff->listDimensions['permissions']['added']);
        $this->assertContains('discount-approval', $diff->listDimensions['policies']['added']);
    }

    public function test_comparison_of_identical_templates_is_identical(): void
    {
        $a = $this->makeCustom('a', ['permissions' => ['sales.orders.view']]);
        $b = $this->makeCustom('b', ['permissions' => ['sales.orders.view']]);

        $this->assertTrue(app(RoleComparisonService::class)->compare($a, $b)->isIdentical());
    }

    // ── Export / Import ───────────────────────────────────────────────────────

    public function test_export_then_import_round_trips_as_a_custom_template(): void
    {
        $this->seedTemplates();
        $source = $this->repository()->findByKey('sales-representative');

        $json = app(RoleTemplateExportService::class)->toJson($source);
        $imported = app(RoleTemplateImportService::class)->import($json);

        $this->assertFalse($imported->is_system);                 // never imports a system template
        $this->assertNotSame($source->key, $imported->key);        // key made unique
        $this->assertSame($source->definition, $imported->definition);
    }

    public function test_import_rejects_malformed_payload(): void
    {
        $this->expectException(RoleTemplateImportException::class);
        app(RoleTemplateImportService::class)->import(['name' => 'no key']);
    }

    public function test_import_rejects_unknown_category(): void
    {
        $this->expectException(RoleTemplateImportException::class);
        app(RoleTemplateImportService::class)->import([
            'key' => 'x', 'name' => 'X', 'category' => 'not-a-category', 'definition' => [],
        ]);
    }
}
