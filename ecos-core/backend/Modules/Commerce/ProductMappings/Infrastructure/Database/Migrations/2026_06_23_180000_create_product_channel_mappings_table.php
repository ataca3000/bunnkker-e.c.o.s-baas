<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('product_channel_mappings')) {
            return;
        }

        Schema::create('product_channel_mappings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignUuid('channel_id')->constrained('channels')->cascadeOnDelete();
            $table->string('external_product_id');
            $table->string('external_sku')->nullable();
            $table->string('sync_status')->default('pending');
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['product_id', 'channel_id']);
            $table->index('sync_status');
            $table->index('channel_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_channel_mappings');
    }
};
