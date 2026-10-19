<?php

declare(strict_types=1);

namespace Tests\Feature\Marketing;

use Tests\TestCase;

/**
 * Regression tests for Marketing module ServiceProvider migration paths.
 *
 * These tests guard against the two-level `../../` path bug that was found in
 * ConnectionServiceProvider and MarketingAssetServiceProvider: the wrong path
 * silently resolved to a non-existent directory, meaning those migration tables
 * were never created in any environment.  Each test verifies the path set in
 * `loadMigrationsFrom(__DIR__ . '/../Database/Migrations')` actually resolves
 * to an existing directory that contains PHP migration files.
 */
class MetaMigrationPathTest extends TestCase
{
    public function test_connection_service_provider_migration_path_exists(): void
    {
        $providerDir = base_path('Modules/Marketing/Connections/Infrastructure/Providers');
        $migPath = realpath($providerDir.'/../Database/Migrations');

        $this->assertNotFalse(
            $migPath,
            'ConnectionServiceProvider migration path `/../Database/Migrations` does not resolve to a real directory.',
        );
        $this->assertDirectoryExists($migPath);

        $files = glob($migPath.'/*.php') ?: [];
        $this->assertNotEmpty($files, 'ConnectionServiceProvider migration directory contains no PHP files.');
    }

    public function test_marketing_asset_service_provider_migration_path_exists(): void
    {
        $providerDir = base_path('Modules/Marketing/Assets/Infrastructure/Providers');
        $migPath = realpath($providerDir.'/../Database/Migrations');

        $this->assertNotFalse(
            $migPath,
            'MarketingAssetServiceProvider migration path `/../Database/Migrations` does not resolve to a real directory.',
        );
        $this->assertDirectoryExists($migPath);

        $files = glob($migPath.'/*.php') ?: [];
        $this->assertNotEmpty($files, 'MarketingAssetServiceProvider migration directory contains no PHP files.');
    }

    public function test_meta_connector_service_provider_migration_path_exists(): void
    {
        $providerDir = base_path('Modules/Marketing/MetaConnector/Infrastructure/Providers');
        $migPath = realpath($providerDir.'/../Database/Migrations');

        $this->assertNotFalse(
            $migPath,
            'MetaConnectorServiceProvider migration path `/../Database/Migrations` does not resolve to a real directory.',
        );
        $this->assertDirectoryExists($migPath);

        $files = glob($migPath.'/*.php') ?: [];
        $this->assertNotEmpty($files, 'MetaConnectorServiceProvider migration directory contains no PHP files.');
    }

    /**
     * Guard against accidentally reintroducing `../../` or `/../../../` which resolves
     * to a non-existent path when the provider sits two levels inside Infrastructure/.
     */
    public function test_marketing_service_providers_do_not_use_multi_level_relative_path(): void
    {
        $providers = [
            'Connections/Infrastructure/Providers/ConnectionServiceProvider.php',
            'Assets/Infrastructure/Providers/MarketingAssetServiceProvider.php',
            'MetaConnector/Infrastructure/Providers/MetaConnectorServiceProvider.php',
        ];

        foreach ($providers as $relative) {
            $path = base_path("Modules/Marketing/$relative");
            $this->assertFileExists($path, "ServiceProvider file not found: $relative");

            $source = (string) file_get_contents($path);

            $this->assertStringNotContainsString(
                "'/../../",
                $source,
                "ServiceProvider $relative uses a double-dot-dot migration path; should be '/../Database/Migrations'.",
            );
        }
    }
}
