<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('companies', 'language')) {
            return;
        }

        Schema::table('companies', function (Blueprint $table): void {
            $table->string('language', 10)->nullable()->after('timezone');
            $table->text('description')->nullable()->after('language');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('companies', 'language')) {
            return;
        }

        Schema::table('companies', function (Blueprint $table): void {
            $table->dropColumn(['language', 'description']);
        });
    }
};
