<?php

declare(strict_types=1);

namespace Modules\Commerce\OrderImport\Application\DTO;

final class OrderImportResultDTO
{
    /**
     * @param  list<string>  $errors
     */
    public function __construct(
        public readonly int $imported_orders,
        public readonly int $created_customers,
        public readonly int $created_orders,
        public readonly int $created_lines,
        public readonly int $skipped_orders,
        public readonly int $failed_lines,
        public readonly array $errors = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'imported_orders' => $this->imported_orders,
            'created_customers' => $this->created_customers,
            'created_orders' => $this->created_orders,
            'created_lines' => $this->created_lines,
            'skipped_orders' => $this->skipped_orders,
            'failed_lines' => $this->failed_lines,
            'errors' => $this->errors,
        ];
    }

    public function summary(): string
    {
        return sprintf(
            'Import completed. %d orders processed, %d customers created, %d orders created, %d lines created, %d skipped, %d lines failed.',
            $this->imported_orders,
            $this->created_customers,
            $this->created_orders,
            $this->created_lines,
            $this->skipped_orders,
            $this->failed_lines,
        );
    }
}
