<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR V1 enhancements — traceability and rule versioning.
 *
 * ┌─ KPI FACTS: WHERE DID THIS NUMBER COME FROM? ───────────────────────────┐
 * │ A fact already knew its module and an opaque reference. It could not say    │
 * │ what KIND of document that reference was, nor when HR received it — and     │
 * │ "the order was on the 30th, we imported it on the 3rd" is exactly the       │
 * │ question a commission dispute turns on. Both are recorded now.              │
 * │                                                                            │
 * │ The reference stays opaque. HR still cannot resolve it into an order, and   │
 * │ still must not: naming the document type is not importing the module.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ COMMISSION RULES: A RATE CHANGE IS A NEW VERSION ──────────────────────┐
 * │ Rules were already dated, and the engine already resolved them as of the    │
 * │ period start — so history was read correctly. What could still rewrite it   │
 * │ was editing a rule IN PLACE: change 2% to 3% and last March silently         │
 * │ recalculates at the new rate, because the row March was paid from no        │
 * │ longer exists.                                                             │
 * │                                                                            │
 * │ These three columns close that. Versions of a rule share a version_group    │
 * │ and form a chain through supersedes_rule_id, so the March row survives      │
 * │ unchanged and the engine keeps finding it.                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hr_kpi_facts', function (Blueprint $table): void {
            if (! Schema::hasColumn('hr_kpi_facts', 'source_document_type')) {
                $table->string('source_document_type', 40)->nullable()->after('source_reference');
            }

            if (! Schema::hasColumn('hr_kpi_facts', 'source_document_number')) {
                $table->string('source_document_number', 80)->nullable()->after('source_document_type');
            }

            // When HR received it, as distinct from when it happened.
            if (! Schema::hasColumn('hr_kpi_facts', 'imported_at')) {
                $table->timestamp('imported_at')->nullable()->after('source_document_number');
            }
        });

        Schema::table('hr_commission_rules', function (Blueprint $table): void {
            if (! Schema::hasColumn('hr_commission_rules', 'version')) {
                $table->unsignedSmallInteger('version')->default(1)->after('code');
            }

            // Every version of one rule shares this. Null until backfilled below.
            if (! Schema::hasColumn('hr_commission_rules', 'version_group')) {
                $table->uuid('version_group')->nullable()->after('version');
            }

            if (! Schema::hasColumn('hr_commission_rules', 'supersedes_rule_id')) {
                $table->uuid('supersedes_rule_id')->nullable()->after('version_group');
            }

            if (! Schema::hasColumn('hr_commission_rules', 'superseded_at')) {
                $table->timestamp('superseded_at')->nullable()->after('supersedes_rule_id');
            }
        });

        // Existing rules are each version 1 of their own lineage.
        \Illuminate\Support\Facades\DB::table('hr_commission_rules')
            ->whereNull('version_group')
            ->orderBy('id')
            ->each(function (object $rule): void {
                \Illuminate\Support\Facades\DB::table('hr_commission_rules')
                    ->where('id', $rule->id)
                    ->update(['version_group' => $rule->id, 'version' => 1]);
            });

        Schema::table('hr_commission_rules', function (Blueprint $table): void {
            $table->index(['company_id', 'version_group'], 'hr_commission_rule_lineage_idx');
        });

        // The code was unique per company in H3; with versions it no longer can be,
        // because every version of a rule keeps the same code. Uniqueness moves to
        // (company, code, version) — one row per version, never two of the same.
        //
        // This widens the constraint rather than relaxing it: every existing row is
        // version 1, so anything the old index permitted the new one permits too,
        // and anything it rejected is still rejected. No existing data can break.
        Schema::table('hr_commission_rules', function (Blueprint $table): void {
            $table->unique(['company_id', 'code', 'version'], 'hr_commission_rule_code_version_uq');
        });

        Schema::table('hr_commission_rules', function (Blueprint $table): void {
            $table->dropUnique('hr_commission_rule_code_unique');
        });

        Schema::table('hr_bonuses', function (Blueprint $table): void {
            // The approver's own words. `notes` is the bonus's description; this is
            // specifically why the decision went the way it did.
            if (! Schema::hasColumn('hr_bonuses', 'approval_reason')) {
                $table->string('approval_reason', 500)->nullable()->after('approved_at');
            }

            // What the engine proposed, frozen next to what a person approved. Kept
            // on the bonus so the gap survives even if the recommendation is purged.
            if (! Schema::hasColumn('hr_bonuses', 'recommended_amount')) {
                $table->decimal('recommended_amount', 15, 2)->nullable()->after('amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hr_bonuses', function (Blueprint $table): void {
            $table->dropColumn(['approval_reason', 'recommended_amount']);
        });

        Schema::table('hr_commission_rules', function (Blueprint $table): void {
            $table->unique(['company_id', 'code'], 'hr_commission_rule_code_unique');
            $table->dropUnique('hr_commission_rule_code_version_uq');
            $table->dropIndex('hr_commission_rule_lineage_idx');
            $table->dropColumn(['version', 'version_group', 'supersedes_rule_id', 'superseded_at']);
        });

        Schema::table('hr_kpi_facts', function (Blueprint $table): void {
            $table->dropColumn(['source_document_type', 'source_document_number', 'imported_at']);
        });
    }
};
