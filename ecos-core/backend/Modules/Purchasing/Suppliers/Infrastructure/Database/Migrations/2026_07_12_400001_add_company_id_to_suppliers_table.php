<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('suppliers', 'company_id')) {
            return;
        }

        Schema::table('suppliers', function (Blueprint $table): void {
            $table->foreignUuid('company_id')
                ->nullable()
                ->after('id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->index('company_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('suppliers', 'company_id')) {
            return;
        }

        Schema::table('suppliers', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });
    }
};
