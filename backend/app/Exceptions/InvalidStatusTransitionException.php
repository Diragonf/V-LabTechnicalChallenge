<?php

declare(strict_types=1);

namespace App\Exceptions;

use DomainException;

final class InvalidStatusTransitionException extends DomainException
{
    public function __construct(
        public readonly string $statusAtual,
        public readonly string $novoStatus,
    ) {
        parent::__construct("A transição de {$statusAtual} para {$novoStatus} não é permitida.");
    }
}
