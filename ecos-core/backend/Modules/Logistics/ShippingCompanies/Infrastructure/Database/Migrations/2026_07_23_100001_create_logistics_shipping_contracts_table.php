<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_shipping_contracts')) {
            return;
        }

        Schema::create('logistics_shipping_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipping_company_id')
                ->constrained('logistics_shipping_companies')
                ->cascadeOnDelete();
            $table->string('name', 150);
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('payment_terms', 255)->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('inactive'); // active | inactive — max one active per company
            $table->timestamps();

            $table->index(['shipping_company_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_shipping_contracts');
    }
};
