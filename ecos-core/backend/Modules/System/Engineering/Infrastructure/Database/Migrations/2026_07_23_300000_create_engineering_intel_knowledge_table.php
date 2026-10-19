<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_intel_knowledge')) {
            return;
        }

        Schema::create('engineering_intel_knowledge', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            // Bounded lengths: these are enum-like slugs, and together with
            // company_id they form the identity unique index, which must
            // stay under MySQL's 3072-byte limit.
            $table->string('category', 32);
            $table->string('failure_type', 64);
            $table->string('root_cause', 128);
            $table->string('resolution_approach')->nullable();
            $table->unsignedInteger('occurrences')->default(0);
            $table->unsignedInteger('success_count')->default(0);
            $table->unsignedInteger('failure_count')->default(0);
            $table->decimal('confidence', 5, 2)->default(0);
            $table->timestamp('last_seen_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'category', 'failure_type', 'root_cause'], 'intel_knowledge_identity_unique');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_intel_knowledge');
    }
};
