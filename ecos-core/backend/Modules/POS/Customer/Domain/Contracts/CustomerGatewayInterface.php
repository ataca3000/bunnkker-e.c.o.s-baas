<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Contracts;

use Modules\POS\Customer\Domain\Exceptions\CustomerNotFoundException;
use Modules\POS\Customer\Domain\ValueObjects\CustomerSnapshot;

interface CustomerGatewayInterface
{
    /** @throws CustomerNotFoundException */
    public function findById(string $customerId): CustomerSnapshot;

    /** @throws CustomerNotFoundException */
    public function findByPhone(string $phone): CustomerSnapshot;

    /** @throws CustomerNotFoundException */
    public function findByEmail(string $email): CustomerSnapshot;

    /** @throws CustomerNotFoundException */
    public function findByCode(string $code): CustomerSnapshot;
}
