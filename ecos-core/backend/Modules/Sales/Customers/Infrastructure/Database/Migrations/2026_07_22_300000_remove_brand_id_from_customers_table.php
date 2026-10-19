<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('customers', 'brand_id')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
            $table->dropIndex('idx_customers_brand');
            $table->dropColumn('brand_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('customers', 'brand_id')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table): void {
            $table->foreignUuid('brand_id')
                ->nullable()
                ->after('company_id')
                ->constrained('brands')
                ->restrictOnDelete();

            $table->index('brand_id', 'idx_customers_brand');
        });
    }
};
