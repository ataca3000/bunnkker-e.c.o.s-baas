<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_runs')) {
            return;
        }

        Schema::create('engineering_runs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('branch', 100)->default('unknown');
            $table->string('commit', 40)->nullable();
            $table->string('mode', 20)->default('full');          // full | fast
            $table->integer('overall_score');
            $table->boolean('release_ready')->default(false);
            $table->json('categories');                            // { php: {score,status,weight}, ... }
            $table->json('metrics');                               // { arch_high: 18, todo_count: 47, ... }
            $table->json('blockers');                              // string[]
            $table->json('report_json')->nullable();               // raw certification JSON payload
            $table->string('report_file', 500)->nullable();        // path to the .json file on disk
            $table->timestamp('certified_at');
            $table->timestamps();

            $table->index('certified_at');
            $table->index('overall_score');
            $table->index('release_ready');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_runs');
    }
};
