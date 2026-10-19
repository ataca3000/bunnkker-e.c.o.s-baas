<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_connections')) {
            return;
        }

        Schema::create('marketing_connections', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable()->index();
            $table->string('connector_type', 30)->index();           // meta | google_ads | tiktok | ...
            $table->string('label', 100);                            // user-given name
            $table->string('status', 30)->default('active')->index(); // active | expired | disconnected | error
            $table->string('external_account_id', 200)->nullable();  // e.g. Meta user_id
            $table->text('access_token')->nullable();                 // encrypted
            $table->text('refresh_token')->nullable();                // encrypted
            $table->timestamp('token_expires_at')->nullable();
            $table->json('scopes')->nullable();                       // granted OAuth scopes
            $table->json('required_scopes')->nullable();              // scopes we need
            $table->timestamp('permissions_validated_at')->nullable();
            $table->timestamp('last_validated_at')->nullable();
            $table->uuid('connected_by')->nullable();
            $table->timestamp('disconnected_at')->nullable();
            $table->uuid('disconnected_by')->nullable();
            $table->json('connector_meta')->nullable();               // connector-specific extra data
            $table->timestamps();

            $table->index(['company_id', 'connector_type']);
            $table->index(['company_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_connections');
    }
};
