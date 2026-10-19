<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Carrier FOUNDATION only — no provider-specific integration.
 *
 * ┌─ DIRECTIVES 4, 9 ───────────────────────────────────────────────────────┐
 * │ Carrier IDENTITY stays in LOG-001 (logistics_shipping_companies).        │
 * │ These tables own CONNECTIVITY: which account, what it can do, and how a  │
 * │ carrier's vocabulary maps onto ECOS's.                                   │
 * │                                                                          │
 * │ CREDENTIALS ARE NOT HERE. They live in the existing Provider Platform's  │
 * │ encrypted store; carrier_accounts holds a provider reference only.       │
 * │ Building a second credential vault would be exactly the duplication      │
 * │ Directive 4 exists to prevent.                                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * carrier_status_mappings is DATA, not code: a new carrier status is mapped by
 * configuration, and only genuinely new BEHAVIOUR needs an adapter change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carrier_accounts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            // LOG-001 by reference. Null = the internal own-fleet adapter,
            // which is a first-class carrier so the core cannot tell the
            // difference between delivering ourselves and tendering out.
            $table->unsignedBigInteger('shipping_company_id')->nullable();
            $table->foreign('shipping_company_id')
                ->references('id')->on('logistics_shipping_companies')->cascadeOnDelete();

            // Selects the adapter from the registry. The ONLY place a carrier
            // is named outside its own adapter directory.
            $table->string('adapter_key', 60);

            $table->string('code', 40);
            $table->string('name', 150);
            $table->string('mode', 20)->default('internal');   // internal | external
            $table->string('status', 20)->default('draft');

            // Pointer into the Provider Platform's encrypted credential store.
            // NEVER a secret itself.
            $table->string('provider_reference', 120)->nullable();

            $table->boolean('is_default')->default(false);
            $table->unsignedSmallInteger('priority')->default(0);
            $table->text('notes')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'carrier_account_company_code_unique');
            $table->index(['company_id', 'status'], 'carrier_account_company_status_idx');
            $table->index('adapter_key', 'carrier_account_adapter_idx');
        });

        Schema::create('carrier_capabilities', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('carrier_account_id')
                ->constrained('carrier_accounts')->cascadeOnDelete();

            // Declared, then asked. A missing capability is a NORMAL answer,
            // not an error — carriers differ enormously.
            $table->string('capability', 40);
            $table->boolean('is_supported')->default(true);
            $table->json('constraints')->nullable();

            $table->timestamps();

            $table->unique(['carrier_account_id', 'capability'], 'carrier_capability_unique');
        });

        Schema::create('carrier_status_mappings', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('carrier_account_id')
                ->constrained('carrier_accounts')->cascadeOnDelete();

            // The carrier's own string — the ONLY place foreign vocabulary is
            // allowed to live outside an adapter.
            $table->string('carrier_status', 80);

            // ECOS vocabulary: LOG-005's DeliveryStatus / FailureReason.
            $table->string('delivery_status', 40)->nullable();
            $table->string('failure_reason', 40)->nullable();
            $table->text('description')->nullable();

            $table->timestamps();

            $table->unique(
                ['carrier_account_id', 'carrier_status'],
                'carrier_status_mapping_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('carrier_status_mappings');
        Schema::dropIfExists('carrier_capabilities');
        Schema::dropIfExists('carrier_accounts');
    }
};
