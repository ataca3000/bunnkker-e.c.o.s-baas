<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('price_approvals', function (Blueprint $table): void {
            if (! Schema::hasColumn('price_approvals', 'old_sale_price')) {
                $table->decimal('old_sale_price', 18, 4)->nullable()->after('new_selling_price');
            }
            if (! Schema::hasColumn('price_approvals', 'new_sale_price')) {
                $table->decimal('new_sale_price', 18, 4)->nullable()->after('old_sale_price');
            }
            if (! Schema::hasColumn('price_approvals', 'margin_pct')) {
                $table->decimal('margin_pct', 8, 4)->nullable()->after('new_sale_price');
            }
            if (! Schema::hasColumn('price_approvals', 'discount_pct')) {
                $table->decimal('discount_pct', 8, 4)->nullable()->after('margin_pct');
            }
            if (! Schema::hasColumn('price_approvals', 'approved_by')) {
                $table->uuid('approved_by')->nullable()->after('manager_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('price_approvals', function (Blueprint $table): void {
            foreach (['old_sale_price', 'new_sale_price', 'margin_pct', 'discount_pct', 'approved_by'] as $col) {
                if (Schema::hasColumn('price_approvals', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
