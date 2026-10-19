<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_cluster_nodes')) {
            return;
        }

        Schema::create('engineering_cluster_nodes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('node_name', 200);
            $table->string('node_type', 50)->default('worker'); // primary|secondary|worker
            $table->string('status', 50)->default('offline'); // active|draining|offline
            $table->string('ip_address', 45)->nullable();
            $table->unsignedSmallInteger('port')->nullable();
            $table->unsignedSmallInteger('worker_count')->default(0);
            $table->unsignedSmallInteger('max_workers')->default(5);
            $table->decimal('cpu_usage_percent', 5, 2)->default(0);
            $table->unsignedInteger('memory_mb_used')->default(0);
            $table->unsignedInteger('memory_mb_total')->nullable();
            $table->decimal('disk_gb_free', 8, 2)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->unique(['company_id', 'node_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_cluster_nodes');
    }
};
