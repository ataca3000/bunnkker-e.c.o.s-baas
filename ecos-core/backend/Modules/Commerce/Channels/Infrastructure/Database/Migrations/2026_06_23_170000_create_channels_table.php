<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('channels')) {
            return;
        }

        Schema::create('channels', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->string('platform');
            $table->string('store_url');
            $table->boolean('is_active')->default(true);
            $table->boolean('sync_products')->default(true);
            $table->boolean('sync_prices')->default(true);
            $table->boolean('sync_stock')->default(true);
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('company_id');
            $table->index('platform');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('channels');
    }
};
