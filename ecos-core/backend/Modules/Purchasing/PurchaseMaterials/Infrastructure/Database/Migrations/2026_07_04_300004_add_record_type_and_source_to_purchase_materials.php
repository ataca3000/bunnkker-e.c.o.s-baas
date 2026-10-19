<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('purchase_materials', 'record_type')) {
            return;
        }

        Schema::table('purchase_materials', function (Blueprint $table) {
            $table->string('record_type', 20)->default('material_request')->after('id');
            $table->string('source_type', 30)->nullable()->after('record_type');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_materials', 'record_type')) {
            return;
        }

        Schema::table('purchase_materials', function (Blueprint $table) {
            $table->dropColumn(['record_type', 'source_type']);
        });
    }
};
