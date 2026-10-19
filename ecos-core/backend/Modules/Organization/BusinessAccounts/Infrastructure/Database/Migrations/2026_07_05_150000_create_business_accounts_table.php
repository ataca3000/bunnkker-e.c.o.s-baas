<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('business_accounts')) {
            return;
        }

        Schema::create('business_accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->foreignUuid('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->string('code', 20);
            $table->string('name');
            $table->string('provider', 50);
            $table->string('status', 20)->default('active');
            $table->text('description')->nullable();
            $table->string('logo', 500)->nullable();
            $table->json('oauth_config')->nullable();
            $table->json('api_keys')->nullable();
            $table->json('webhook_config')->nullable();
            $table->json('sync_settings')->nullable();
            $table->json('external_metadata')->nullable();
            $table->timestampsTz();
            $table->softDeletes();
            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'provider']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_accounts');
    }
};
