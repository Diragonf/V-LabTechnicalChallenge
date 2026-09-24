<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Database\PostgresConnection;
use Illuminate\Support\Facades\DB;
use Mockery;
use RuntimeException;
use Tests\TestCase;

final class HealthCheckTest extends TestCase
{
    public function test_health_executa_consulta_ativa_e_retorna_200(): void
    {
        $this->freezeTime();
        $connection = Mockery::mock(PostgresConnection::class);
        DB::shouldReceive('connection')->once()->with('pgsql')->andReturn($connection);
        $connection->shouldReceive('getDriverName')->once()->andReturn('pgsql');
        $connection->shouldReceive('selectOne')->once()->with('SELECT 1 AS connected', [], false)
            ->andReturn((object) ['connected' => 1]);

        $response = $this->getJson('/api/v1/health')->assertOk()->assertExactJson([
            'status' => 'ok',
            'database' => 'connected',
            'timestamp' => now()->toISOString(),
        ]);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_health_retorna_503_sem_detalhes_quando_a_consulta_falha(): void
    {
        $this->freezeTime();
        config(['app.debug' => true]);
        $connection = Mockery::mock(PostgresConnection::class);
        DB::shouldReceive('connection')->once()->with('pgsql')->andReturn($connection);
        $connection->shouldReceive('getDriverName')->once()->andReturn('pgsql');
        $connection->shouldReceive('selectOne')->once()->with('SELECT 1 AS connected', [], false)
            ->andThrow(new RuntimeException('DETALHE_INTERNO_FICTICIO'));

        $this->getJson('/api/v1/health')->assertStatus(503)->assertExactJson([
            'status' => 'error',
            'database' => 'disconnected',
            'timestamp' => now()->toISOString(),
        ])->assertDontSee('DETALHE_INTERNO_FICTICIO');
    }

    public function test_health_retorna_503_quando_a_conexao_nao_pode_ser_criada(): void
    {
        DB::shouldReceive('connection')->once()->with('pgsql')
            ->andThrow(new RuntimeException('Conexão fictícia indisponível.'));

        $this->getJson('/api/v1/health')->assertStatus(503)
            ->assertJsonPath('status', 'error')->assertJsonPath('database', 'disconnected');
    }
}
