<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_products')) {
            return;
        }

        Schema::create('marketing_campaign_products', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_draft_id')->index();

            $table->string('product_type', 50);
            $table->string('product_id', 36)->index();
            $table->string('product_name', 500)->nullable();
            $table->string('product_sku', 255)->nullable();

            // Availability snapshot (refreshed before publishing)
            $table->string('availability_status', 30)->default('available');
            $table->integer('quantity_available')->nullable();
            $table->boolean('warn_if_unavailable')->default(true);
            $table->timestamp('last_checked_at')->nullable();

            $table->timestamps();

            $table->unique(['campaign_draft_id', 'product_type', 'product_id'], 'mkt_cp_draft_product_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_products');
    }
};
