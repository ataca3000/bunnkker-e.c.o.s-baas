<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Service — EPIC C3. Knowledge base articles.
 *
 * Help content agents and customers can search — draft → published → archived.
 * Distinct from the resolution library (canned agent replies applied to a case).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_kb_articles')) {
            return;
        }

        Schema::create('crm_kb_articles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('title', 250);
            $table->string('slug', 280);
            $table->longText('body');
            $table->string('category', 80)->nullable();
            $table->json('tags')->nullable();
            $table->string('status', 12)->default('draft'); // draft | published | archived
            $table->unsignedInteger('views')->default(0);
            $table->unsignedBigInteger('author_id')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'slug'], 'crm_kb_company_slug_unique');
            $table->index(['company_id', 'status', 'category'], 'crm_kb_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_kb_articles');
    }
};
