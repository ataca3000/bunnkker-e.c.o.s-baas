<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_assets')) {
            return;
        }

        Schema::create('marketing_assets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable()->index();
            $table->uuid('marketing_connection_id')->index();
            $table->string('connector_type', 30)->index();           // meta | google_ads | ...
            $table->string('asset_type', 50)->index();               // business_manager | ad_account | page | instagram | ...
            $table->string('external_id', 200);                      // platform asset ID
            $table->string('name', 500);
            $table->string('status', 30)->default('active')->index(); // active | inactive | archived
            $table->string('health_status', 30)->default('healthy'); // healthy | warning | disconnected | expired_token | ...
            $table->timestamp('health_checked_at')->nullable();
            $table->json('health_metadata')->nullable();
            $table->json('asset_metadata')->nullable();              // currency, timezone, account_type, etc.
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamp('next_sync_at')->nullable();
            $table->timestamps();

            // Unique: no duplicate assets per platform
            $table->unique(['connector_type', 'external_id']);
            $table->index(['connector_type', 'asset_type']);
            $table->index(['company_id', 'asset_type', 'health_status']);
            $table->index('health_status');

            $table->foreign('marketing_connection_id')
                ->references('id')->on('marketing_connections')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_assets');
    }
};
