<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_sync_logs')) {
            return;
        }

        Schema::create('marketing_sync_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('marketing_connection_id')->index();
            $table->string('sync_type', 30)->default('manual');      // manual | scheduled | incremental | full
            $table->string('status', 30)->default('pending')->index(); // pending | running | completed | failed | cancelled
            $table->integer('assets_discovered')->default(0);
            $table->integer('assets_created')->default(0);
            $table->integer('assets_updated')->default(0);
            $table->integer('assets_failed')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->uuid('triggered_by')->nullable();
            $table->text('error_message')->nullable();
            $table->json('sync_metadata')->nullable();
            $table->timestamps();

            $table->index(['marketing_connection_id', 'status']);
            $table->index(['marketing_connection_id', 'created_at']);

            $table->foreign('marketing_connection_id')
                ->references('id')->on('marketing_connections')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_sync_logs');
    }
};
