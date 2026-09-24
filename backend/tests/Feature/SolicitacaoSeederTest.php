<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Solicitacao;
use Database\Seeders\SolicitacaoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class SolicitacaoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_cria_vinte_registros_validos_com_cobertura_completa(): void
    {
        $this->seed(SolicitacaoSeeder::class);
        $registros = Solicitacao::all();

        $this->assertCount(20, $registros);
        $this->assertCount(20, $registros->pluck('protocolo')->unique());
        $this->assertEqualsCanonicalizing(['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'], $registros->pluck('categoria')->unique()->all());

        foreach (['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as $prioridade) {
            $this->assertEqualsCanonicalizing(
                ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'],
                $registros->where('prioridade', $prioridade)->pluck('status')->all(),
            );
        }

        foreach ($registros as $registro) {
            $this->assertStringStartsWith('Pessoa fictícia — ', $registro->nome_solicitante);
            $this->assertTrue($registro->data_atualizacao->greaterThanOrEqualTo($registro->data_criacao));
            if ($registro->prioridade === 'URGENTE') {
                $this->assertNotEmpty(trim($registro->justificativa_prioridade));
            }
        }

        // Verifica a consulta real ao PostgreSQL utilizado pelos testes de integração.
        $this->getJson('/api/v1/health')->assertOk()
            ->assertJsonPath('status', 'ok')->assertJsonPath('database', 'connected');
    }

    public function test_factory_urgente_funciona_com_state_e_override(): void
    {
        $this->assertNotEmpty(Solicitacao::factory()->urgente()->make()->justificativa_prioridade);
        $this->assertNotEmpty(Solicitacao::factory()->make([
            'prioridade' => 'URGENTE',
            'justificativa_prioridade' => '   ',
        ])->justificativa_prioridade);
    }

    public function test_executar_seeder_novamente_preserva_os_registros_existentes(): void
    {
        $this->seed(SolicitacaoSeeder::class);
        $primeiroProtocolo = Solicitacao::query()->firstOrFail()->protocolo;
        Solicitacao::query()->where('protocolo', $primeiroProtocolo)->update(['descricao' => 'Descrição editada após o seed.']);
        $registroDoUsuario = Solicitacao::factory()->create();
        $this->seed(SolicitacaoSeeder::class);

        $this->assertDatabaseCount('solicitacoes', 21);
        $this->assertDatabaseHas('solicitacoes', ['protocolo' => $primeiroProtocolo, 'descricao' => 'Descrição editada após o seed.']);
        $this->assertDatabaseHas('solicitacoes', ['id' => $registroDoUsuario->id]);
    }
}
