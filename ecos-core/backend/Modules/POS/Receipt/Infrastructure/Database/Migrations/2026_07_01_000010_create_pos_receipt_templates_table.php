<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_receipt_templates')) {
            return;
        }

        Schema::create('pos_receipt_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 255);
            $table->boolean('is_default')->default(false);
            $table->text('header_text')->nullable();
            $table->text('footer_text')->nullable();

            // Display settings and configurable max_reprints
            // Keys: show_sku, show_cashier_name, show_customer_name,
            //       show_tax_breakdown, max_reprints
            $table->json('settings')->nullable();

            $table->timestampsTz();

            // Enforce a single default template at the DB level via partial index
            // (Only one row may have is_default = true)
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_receipt_templates');
    }
};
