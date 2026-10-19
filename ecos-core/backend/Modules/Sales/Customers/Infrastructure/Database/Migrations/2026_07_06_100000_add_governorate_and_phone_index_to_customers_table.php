<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('customers', 'governorate')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table): void {
            $table->string('governorate')->nullable()->after('city');
            $table->string('area')->nullable()->after('governorate');
            $table->index('phone');
            $table->index('mobile');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('customers', 'governorate')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table): void {
            $table->dropIndex(['phone']);
            $table->dropIndex(['mobile']);
            $table->dropColumn(['area', 'governorate']);
        });
    }
};
