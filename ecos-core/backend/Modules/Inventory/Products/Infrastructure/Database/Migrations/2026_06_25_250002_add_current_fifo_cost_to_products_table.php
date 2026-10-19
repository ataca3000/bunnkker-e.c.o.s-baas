<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('products', 'current_fifo_cost')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            // Cost of the oldest available receipt layer — the true FIFO "next to ship" cost
            $table->decimal('current_fifo_cost', 15, 4)->nullable()->after('last_supplier_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'current_fifo_cost')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn('current_fifo_cost');
        });
    }
};
