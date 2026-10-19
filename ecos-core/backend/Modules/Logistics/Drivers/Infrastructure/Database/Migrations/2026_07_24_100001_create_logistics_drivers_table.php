<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_drivers')) {
            return;
        }

        Schema::create('logistics_drivers', function (Blueprint $table) {
            $table->id();

            // ── Identity (BR-1, BR-2, BR-3: all three are unique) ────────────
            $table->string('driver_code', 30)->unique();
            $table->string('full_name', 150);
            $table->string('mobile', 30)->unique();
            $table->string('national_id', 30)->unique();
            $table->date('date_of_birth')->nullable();
            $table->string('address', 500)->nullable();
            $table->date('employment_date')->nullable();

            // ── Employer (TASK-LOG-001 integration) ──────────────────────────
            $table->foreignId('shipping_company_id')
                ->nullable()
                ->constrained('logistics_shipping_companies')
                ->nullOnDelete();

            // ── Licence ──────────────────────────────────────────────────────
            $table->string('license_number', 50)->nullable();
            $table->string('license_type', 30)->nullable();
            $table->date('license_issue_date')->nullable();
            $table->date('license_expiry_date')->nullable();
            $table->string('license_issuing_authority', 150)->nullable();

            // ── Lifecycle (BR-5: archive only, never deleted) ────────────────
            $table->string('status', 20)->default('active'); // active | inactive | archived
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('shipping_company_id');
            $table->index('license_expiry_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_drivers');
    }
};
