<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_sync_logs')) {
            return;
        }

        Schema::create('stock_sync_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('channel_id')->constrained('channels')->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignUuid('product_mapping_id')->constrained('product_channel_mappings')->cascadeOnDelete();
            $table->decimal('stock_quantity', 15, 4);
            $table->string('sync_status');
            $table->text('response_message')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->index(['channel_id', 'sync_status']);
            $table->index('product_id');
            $table->index('synced_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_sync_logs');
    }
};
