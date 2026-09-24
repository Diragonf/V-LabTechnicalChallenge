<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Throwable;

final class HealthCheckService
{
    public function databaseConnected(): bool
    {
        try {
            $connection = DB::connection('pgsql');

            // Consulta ativa no servidor de escrita; não basta existir uma configuração/PDO.
            return $connection->getDriverName() === 'pgsql'
                && (int) $connection->selectOne('SELECT 1 AS connected', [], false)->connected === 1;
        } catch (Throwable) {
            return false;
        }
    }
}
