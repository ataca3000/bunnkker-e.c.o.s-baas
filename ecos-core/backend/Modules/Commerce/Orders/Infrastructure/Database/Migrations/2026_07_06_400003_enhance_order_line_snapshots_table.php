<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('order_line_snapshots', 'source_recipe_version')) {
            return;
        }

        Schema::table('order_line_snapshots', function (Blueprint $table) {
            // PART 4 — Source reference: recipe version string (bom_id already stores UUID)
            $table->string('source_recipe_version', 20)->nullable()->after('bom_version_number');

            // PART 7 — Per-line margin diagnostics
            $table->decimal('target_margin_percent', 8, 4)->nullable()->after('source_recipe_version');
            // 'within_target' | 'below_target' | 'above_target'
            $table->string('margin_status')->nullable()->after('target_margin_percent');

            // PART 8 — Price review provenance
            $table->uuid('price_review_id')->nullable()->after('margin_status');
            $table->timestamp('price_review_approved_at')->nullable()->after('price_review_id');
            $table->uuid('price_review_approved_by')->nullable()->after('price_review_approved_at');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('order_line_snapshots', 'source_recipe_version')) {
            return;
        }

        Schema::table('order_line_snapshots', function (Blueprint $table) {
            $table->dropColumn([
                'source_recipe_version',
                'target_margin_percent',
                'margin_status',
                'price_review_id',
                'price_review_approved_at',
                'price_review_approved_by',
            ]);
        });
    }
};
