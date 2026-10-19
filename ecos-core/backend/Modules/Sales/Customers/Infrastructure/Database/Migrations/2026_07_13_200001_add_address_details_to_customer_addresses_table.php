<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('customer_addresses', 'building')) {
            return;
        }

        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->string('building')->nullable()->after('address_line');
            $table->string('floor')->nullable()->after('building');
            $table->string('apartment')->nullable()->after('floor');
            $table->string('landmark')->nullable()->after('apartment');
            $table->text('address_notes')->nullable()->after('landmark');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('customer_addresses', 'building')) {
            return;
        }

        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->dropColumn(['building', 'floor', 'apartment', 'landmark', 'address_notes']);
        });
    }
};
