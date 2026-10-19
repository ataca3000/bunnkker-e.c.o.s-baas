<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_release_candidates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('title', 500);
            $table->text('description')->nullable();
            $table->string('status', 50)->default('draft');
            $table->string('version_tag', 50)->nullable();
            $table->uuid('created_by_id');
            $table->uuid('reviewed_by_id')->nullable();
            $table->timestamp('review_started_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('staged_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('rolled_back_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedInteger('version')->default(0);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_release_candidates');
    }
};
