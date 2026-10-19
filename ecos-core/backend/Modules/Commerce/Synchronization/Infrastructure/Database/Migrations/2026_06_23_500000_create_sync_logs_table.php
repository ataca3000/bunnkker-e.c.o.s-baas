<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('sync_logs')) {
            return;
        }

        Schema::create('sync_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('channel_id')->nullable()->constrained('channels')->nullOnDelete();
            $table->string('entity_type', 50);
            $table->string('entity_id', 100)->nullable();
            $table->string('direction', 20);
            $table->string('action', 100)->nullable();
            $table->string('status', 20)->default('pending');
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->index(['channel_id', 'entity_type', 'status']);
            $table->index('synced_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_logs');
    }
};
