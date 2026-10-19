<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductImport\Application\DTO;

final class ImportResultDTO
{
    /**
     * @param  list<string>  $errors
     */
    public function __construct(
        public readonly int $imported,
        public readonly int $created_products,
        public readonly int $created_mappings,
        public readonly int $failed,
        public readonly int $categories_created,
        public readonly int $categories_updated,
        public readonly array $errors = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'imported' => $this->imported,
            'created_products' => $this->created_products,
            'created_mappings' => $this->created_mappings,
            'failed' => $this->failed,
            'categories_created' => $this->categories_created,
            'categories_updated' => $this->categories_updated,
            'errors' => $this->errors,
        ];
    }

    public function summary(): string
    {
        return sprintf(
            'Import completed. %d processed, %d products created, %d categories created, %d failed.',
            $this->imported,
            $this->created_products,
            $this->categories_created,
            $this->failed,
        );
    }
}
