<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feature_flags', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->string('company_id', 36)->nullable()->index();
            $table->string('key', 100)->index();
            $table->boolean('enabled')->default(false);
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['key', 'company_id'], 'idx_feature_flags_key_company');
        });

        $this->seedDefaultFlags();
    }

    public function down(): void
    {
        Schema::dropIfExists('feature_flags');
    }

    private function seedDefaultFlags(): void
    {
        $now = now()->toDateTimeString();
        $flags = [
            ['key' => 'modules.preparation_os',      'enabled' => true,  'description' => 'Preparation OS module'],
            ['key' => 'workflow.preparation',         'enabled' => true,  'description' => 'Preparation workflow'],
            ['key' => 'ai.preparation',               'enabled' => false, 'description' => 'AI features in Preparation OS'],
            ['key' => 'preparation.mobile',           'enabled' => false, 'description' => 'Mobile UI for Preparation OS'],
            ['key' => 'preparation.analytics',        'enabled' => true,  'description' => 'Analytics for Preparation OS'],
            ['key' => 'preparation.wave_approval',    'enabled' => false, 'description' => 'Require supervisor wave approval'],
            ['key' => 'preparation.quality_check',    'enabled' => false, 'description' => 'Require pool quality check'],
            ['key' => 'preparation.auto_mrp',         'enabled' => false, 'description' => 'Auto-run MRP after demand generation'],
            ['key' => 'preparation.auto_prp',         'enabled' => false, 'description' => 'Auto-run PRP after demand generation'],
        ];

        foreach ($flags as $flag) {
            DB::table('feature_flags')->insert([
                'id' => Illuminate\Support\Str::uuid()->toString(),
                'company_id' => null,
                'key' => $flag['key'],
                'enabled' => $flag['enabled'],
                'description' => $flag['description'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
};
