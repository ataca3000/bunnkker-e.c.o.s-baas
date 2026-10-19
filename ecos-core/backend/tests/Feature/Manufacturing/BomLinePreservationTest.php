<?php

declare(strict_types=1);

namespace Tests\Feature\Manufacturing;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Application\Actions\SetBomStatusAction;
use Modules\Manufacturing\BillsOfMaterials\Application\Actions\UpdateBomAction;
use Modules\Manufacturing\BillsOfMaterials\Application\DTO\BomDTO;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;
use Tests\TestCase;

/**
 * BUG-BOM-DATA-LOSS-001 — regression suite.
 *
 * Toggling a recipe's status used to delete every component line. The list
 * endpoint omits `lines`, the frontend rebuilt a full payload from a list row,
 * `lines` became `[]`, and the update replaced the components with nothing.
 *
 * These tests pin the contract that makes that impossible:
 *   • `lines` absent  -> leave the existing components alone
 *   • `lines` present -> replace them (that is what an update is for)
 * and prove the status path never touches components at all, however many
 * times it is exercised.
 */
class BomLinePreservationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    /**
     * A recipe with two components, created through the repository so the test
     * exercises the same path production does.
     */
    private function makeBomWithLines(int $lineCount = 2): BillOfMaterial
    {
        $product = Product::factory()->finishedGood()->manufacturable()->create();

        $bom = BillOfMaterial::create([
            'bom_number' => 'BOM-REG-'.uniqid(),
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => false,
        ]);

        for ($i = 0; $i < $lineCount; $i++) {
            $bom->lines()->create([
                'raw_material_id' => Product::factory()->rawMaterial()->create()->id,
                'quantity' => 2.0 + $i,
                'waste_percentage' => 0,
            ]);
        }

        return $bom->fresh(['lines']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function payload(BillOfMaterial $bom, array $overrides = []): array
    {
        return array_merge([
            'product_id' => (string) $bom->product_id,
            'version' => (string) $bom->version,
            'is_active' => (bool) $bom->is_active,
        ], $overrides);
    }

    // ── 1. Omitted lines preserve the recipe ─────────────────────────────────

    public function test_update_without_lines_key_preserves_existing_components(): void
    {
        $bom = $this->makeBomWithLines(2);
        $this->assertCount(2, $bom->lines);

        // No `lines` key at all — the exact shape a status-only caller sends.
        app(UpdateBomAction::class)->execute(
            $bom,
            BomDTO::fromArray($this->payload($bom, ['is_active' => true])),
        );

        $this->assertCount(
            2,
            $bom->fresh(['lines'])->lines,
            'Omitting `lines` must never delete components.',
        );
    }

    public function test_dto_maps_absent_lines_to_null_not_empty_array(): void
    {
        $dto = BomDTO::fromArray([
            'product_id' => (string) Product::factory()->finishedGood()->create()->id,
            'version' => '1.0',
            'is_active' => true,
        ]);

        $this->assertNull($dto->lines, 'Absent `lines` must be null, never [].');
    }

    // ── 2. Explicit replacement still replaces ───────────────────────────────

    public function test_update_with_lines_replaces_components(): void
    {
        $bom = $this->makeBomWithLines(2);
        $replacement = Product::factory()->rawMaterial()->create();

        app(UpdateBomAction::class)->execute($bom, BomDTO::fromArray($this->payload($bom, [
            'lines' => [[
                'raw_material_id' => (string) $replacement->id,
                'quantity' => 7.5,
                'waste_percentage' => 0,
            ]],
        ])));

        $lines = $bom->fresh(['lines'])->lines;

        $this->assertCount(1, $lines, 'An explicit lines array must replace the components.');
        $this->assertSame((string) $replacement->id, (string) $lines->first()->raw_material_id);
    }

    public function test_dto_maps_present_lines_to_an_array(): void
    {
        $dto = BomDTO::fromArray([
            'product_id' => (string) Product::factory()->finishedGood()->create()->id,
            'version' => '1.0',
            'is_active' => true,
            'lines' => [],
        ]);

        $this->assertIsArray($dto->lines, 'An explicit [] must stay an array, not become null.');
        $this->assertSame([], $dto->lines);
    }

    // ── 3. The status endpoint never touches components ──────────────────────

    public function test_set_status_action_preserves_components(): void
    {
        $bom = $this->makeBomWithLines(3);

        app(SetBomStatusAction::class)->execute($bom, true);

        $fresh = $bom->fresh(['lines']);
        $this->assertTrue((bool) $fresh->is_active);
        $this->assertCount(3, $fresh->lines, 'A status change must not touch components.');
    }

    public function test_repeated_activate_deactivate_cycles_preserve_components(): void
    {
        $bom = $this->makeBomWithLines(2);
        $original = $bom->lines->pluck('raw_material_id')->sort()->values()->all();

        // The reported symptom appeared after toggling; ten cycles is well past
        // any plausible off-by-one and cheap to run.
        for ($i = 0; $i < 10; $i++) {
            app(SetBomStatusAction::class)->execute($bom->fresh(), $i % 2 === 0);
        }

        $fresh = $bom->fresh(['lines']);

        $this->assertCount(2, $fresh->lines, 'Components must survive unlimited toggle cycles.');
        $this->assertSame(
            $original,
            $fresh->lines->pluck('raw_material_id')->sort()->values()->all(),
            'The same components must survive, not merely the same count.',
        );
    }

    // ── 4. HTTP surface ──────────────────────────────────────────────────────

    public function test_status_endpoint_preserves_components(): void
    {
        $bom = $this->makeBomWithLines(2);

        $this->actingAs($this->user)
            ->patchJson("/api/boms/{$bom->id}/status", ['is_active' => true])
            ->assertOk();

        $this->assertCount(2, $bom->fresh(['lines'])->lines);
    }

    public function test_status_endpoint_rejects_a_missing_flag(): void
    {
        $bom = $this->makeBomWithLines(1);

        $this->actingAs($this->user)
            ->patchJson("/api/boms/{$bom->id}/status", [])
            ->assertStatus(422);
    }

    /**
     * The status endpoint accepts one field. Anything else is discarded by
     * validated(), so a caller cannot smuggle a structural change through it.
     */
    public function test_status_endpoint_ignores_a_lines_key(): void
    {
        $bom = $this->makeBomWithLines(2);

        $this->actingAs($this->user)
            ->patchJson("/api/boms/{$bom->id}/status", [
                'is_active' => true,
                'lines' => [],
            ])
            ->assertOk();

        $this->assertCount(
            2,
            $bom->fresh(['lines'])->lines,
            'A lines key on the status endpoint must be ignored, not honoured.',
        );
    }

    // ── 5. Create still requires components ──────────────────────────────────

    public function test_update_endpoint_rejects_an_empty_lines_array(): void
    {
        $bom = $this->makeBomWithLines(2);

        // `min:1` survives the change from required to sometimes, so the update
        // endpoint cannot empty a recipe even when asked directly.
        $this->actingAs($this->user)
            ->putJson("/api/boms/{$bom->id}", $this->payload($bom, ['lines' => []]))
            ->assertStatus(422);

        $this->assertCount(2, $bom->fresh(['lines'])->lines);
    }
}
