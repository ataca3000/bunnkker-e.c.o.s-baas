<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_provider_credentials')) {
            return;
        }

        Schema::create('marketing_provider_credentials', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('provider', 50);          // meta, google_ads, tiktok, etc.
            $table->string('app_id', 255)->nullable();
            $table->text('app_secret')->nullable();   // encrypted at rest
            $table->string('redirect_uri', 500)->nullable();
            $table->text('extra_config')->nullable(); // encrypted JSON for provider-specific fields
            $table->string('status', 50)->default('not_configured');
            $table->timestamp('validated_at')->nullable();
            $table->uuid('validated_by')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'provider']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_provider_credentials');
    }
};
