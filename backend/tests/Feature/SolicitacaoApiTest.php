<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Solicitacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

final class SolicitacaoApiTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, string> */
    private function dados(): array
    {
        return [
            'nome_solicitante' => 'Pessoa Fictícia Alfa',
            'categoria' => 'CONSULTA',
            'prioridade' => 'MEDIA',
            'descricao' => 'Solicitação fictícia para teste.',
        ];
    }

    public function test_cria_detalha_e_gera_protocolos_distintos(): void
    {
        $this->travelTo(\Illuminate\Support\Carbon::parse('2026-09-23 12:00:00', 'UTC'));
        $primeira = $this->postJson('/api/v1/solicitacoes', $this->dados())
            ->assertCreated()
            ->assertJsonPath('data.status', 'RECEBIDA')
            ->assertJsonPath('data.justificativa_prioridade', null);
        $segunda = $this->postJson('/api/v1/solicitacoes', $this->dados())->assertCreated();

        $this->assertMatchesRegularExpression('/^SOL-20260923-[A-F0-9]{16}$/', $primeira->json('data.protocolo'));
        $this->assertNotSame($primeira->json('data.protocolo'), $segunda->json('data.protocolo'));
        $this->assertDatabaseCount('solicitacoes', 2);
        $this->assertDatabaseHas('solicitacoes', [
            'id' => $primeira->json('data.id'),
            'protocolo' => $primeira->json('data.protocolo'),
        ]);
        $this->getJson('/api/v1/solicitacoes/'.$primeira->json('data.id'))
            ->assertOk()->assertJsonPath('data.nome_solicitante', 'Pessoa Fictícia Alfa');
    }

    public function test_urgente_exige_justificativa_com_texto(): void
    {
        $this->postJson('/api/v1/solicitacoes', array_merge($this->dados(), ['prioridade' => 'URGENTE']))
            ->assertUnprocessable()->assertJsonValidationErrors('justificativa_prioridade');

        foreach ([null, '', '   ', "\u{00A0}"] as $justificativa) {
            $this->postJson('/api/v1/solicitacoes', array_merge($this->dados(), [
                'prioridade' => 'URGENTE',
                'justificativa_prioridade' => $justificativa,
            ]))->assertUnprocessable()->assertJsonValidationErrors('justificativa_prioridade');
        }

        $this->assertDatabaseCount('solicitacoes', 0);
        $this->postJson('/api/v1/solicitacoes', array_merge($this->dados(), [
            'prioridade' => 'URGENTE',
            'justificativa_prioridade' => 'Motivo fictício.',
        ]))->assertCreated();
    }

    public function test_rejeita_campos_desconhecidos_e_valores_invalidos(): void
    {
        $invalidos = [
            'protocolo' => 'SOL-FORJADO',
            'status' => 'CONCLUIDA',
            'id' => 123,
            'data_criacao' => '2026-01-01',
            'categoria' => 'INVALIDA',
            'prioridade' => 'urgente',
            'nome_solicitante' => str_repeat('A', 256),
            'descricao' => ['valor' => 'inválido'],
        ];
        foreach ($invalidos as $campo => $valor) {
            $this->postJson('/api/v1/solicitacoes', array_merge($this->dados(), [$campo => $valor]))
                ->assertUnprocessable()->assertJsonValidationErrors($campo);
        }
        $this->assertDatabaseCount('solicitacoes', 0);
    }

    public function test_todas_as_transicoes_e_estados_finais(): void
    {
        $transicoes = [
            'RECEBIDA' => ['EM_ANALISE', 'CANCELADA'],
            'EM_ANALISE' => ['AGENDADA', 'CANCELADA'],
            'AGENDADA' => ['CONCLUIDA', 'CANCELADA'],
            'CONCLUIDA' => [],
            'CANCELADA' => [],
        ];

        foreach ($transicoes as $atual => $permitidos) {
            foreach (array_keys($transicoes) as $novo) {
                $id = $this->postJson('/api/v1/solicitacoes', $this->dados())->assertCreated()->json('data.id');
                Solicitacao::query()->whereKey($id)->update(['status' => $atual]);
                $resposta = $this->patchJson("/api/v1/solicitacoes/{$id}/status", ['status' => $novo]);
                if (in_array($novo, $permitidos, true)) {
                    $resposta->assertOk()->assertJsonPath('data.status', $novo);
                } else {
                    $resposta->assertUnprocessable()->assertExactJson([
                        'message' => "A transição de {$atual} para {$novo} não é permitida.",
                        'errors' => ['status' => ["A transição de {$atual} para {$novo} não é permitida."]],
                    ]);
                    $this->assertDatabaseHas('solicitacoes', ['id' => $id, 'status' => $atual]);
                }
            }
        }
    }

    public function test_recebida_nao_pode_ser_concluida_e_retorna_422_explicativo(): void
    {
        $solicitacao = Solicitacao::factory()->create(['status' => 'RECEBIDA']);
        $antes = $solicitacao->fresh()->getRawOriginal();

        $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", ['status' => 'CONCLUIDA'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'A transição de RECEBIDA para CONCLUIDA não é permitida.')
            ->assertJsonValidationErrors('status');

        $this->assertSame($antes, $solicitacao->fresh()->getRawOriginal());
    }

    public function test_lista_com_filtros_combinados_e_paginacao(): void
    {
        $alvos = Solicitacao::factory()->count(3)->create([
            'status' => 'EM_ANALISE', 'categoria' => 'EXAME', 'prioridade' => 'ALTA',
        ]);
        // Cada distrator difere em um único filtro: ignorar qualquer filtro faz o teste falhar.
        foreach ([['status' => 'RECEBIDA'], ['categoria' => 'CONSULTA'], ['prioridade' => 'BAIXA']] as $diferenca) {
            Solicitacao::factory()->create(array_merge([
                'status' => 'EM_ANALISE', 'categoria' => 'EXAME', 'prioridade' => 'ALTA',
            ], $diferenca));
        }
        $query = '/api/v1/solicitacoes?status=EM_ANALISE&categoria=EXAME&prioridade=ALTA&per_page=2';
        $primeira = $this->getJson($query.'&page=1')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3)->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.per_page', 2)->assertJsonPath('meta.current_page', 1);
        $segunda = $this->getJson($query.'&page=2')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.current_page', 2)->assertJsonPath('links.next', null);
        $ids = array_merge(array_column($primeira->json('data'), 'id'), array_column($segunda->json('data'), 'id'));
        $this->assertSame($alvos->pluck('id')->sortDesc()->values()->all(), $ids);
        $this->assertStringContainsString('prioridade=ALTA', $primeira->json('links.next'));
        $this->assertStringContainsString('categoria=EXAME', $primeira->json('links.next'));
        $this->assertStringContainsString('status=EM_ANALISE', $primeira->json('links.next'));
        $this->getJson($query.'&page=100')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_filtra_cada_campo_individualmente(): void
    {
        Solicitacao::factory()->create(['status' => 'RECEBIDA', 'categoria' => 'CONSULTA', 'prioridade' => 'BAIXA']);
        $b = Solicitacao::factory()->create(['status' => 'EM_ANALISE', 'categoria' => 'EXAME', 'prioridade' => 'URGENTE']);
        Solicitacao::factory()->create(['status' => 'CANCELADA', 'categoria' => 'VACINACAO', 'prioridade' => 'ALTA']);

        foreach (['status' => 'EM_ANALISE', 'categoria' => 'EXAME', 'prioridade' => 'URGENTE'] as $campo => $valor) {
            $this->getJson("/api/v1/solicitacoes?{$campo}={$valor}")->assertOk()
                ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $b->id)
                ->assertJsonPath('meta.total', 1);
        }
        $this->getJson('/api/v1/solicitacoes?categoria=OUTRO')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_paginacao_padrao_tem_quinze_itens(): void
    {
        Solicitacao::factory()->count(16)->create();
        $this->getJson('/api/v1/solicitacoes')->assertOk()->assertJsonCount(15, 'data')
            ->assertJsonPath('meta.total', 16)->assertJsonPath('meta.per_page', 15);
    }

    public function test_rejeita_filtros_e_paginacao_invalidos(): void
    {
        foreach (['page=0', 'per_page=101', 'per_page=abc', 'status=INVALIDO', 'categoria=', 'prioridade[]=ALTA', 'extra=1'] as $query) {
            $this->getJson('/api/v1/solicitacoes?'.$query)->assertUnprocessable();
        }
        $this->patchJson('/api/v1/solicitacoes/1/status', ['status' => 'INVALIDO'])->assertUnprocessable();
        $this->patchJson('/api/v1/solicitacoes/1/status', ['status' => 'EM_ANALISE', 'prioridade' => 'ALTA'])
            ->assertUnprocessable()->assertJsonValidationErrors('prioridade');
    }

    public function test_ids_inexistentes_invalidos_e_overflow_retornam_404(): void
    {
        foreach (['1', '0', '-1', 'abc', '9223372036854775808'] as $id) {
            $this->getJson('/api/v1/solicitacoes/'.$id)->assertNotFound();
            $this->patchJson("/api/v1/solicitacoes/{$id}/status", ['status' => 'EM_ANALISE'])->assertNotFound();
        }
    }

    public function test_json_malformado_e_tipo_de_conteudo_incorreto(): void
    {
        foreach (['{', '[]', 'null', '"texto"'] as $body) {
            $this->call('POST', '/api/v1/solicitacoes', [], [], [], ['CONTENT_TYPE' => 'application/json'], $body)
                ->assertStatus(400)->assertJsonStructure(['message', 'errors']);
        }
        $this->post('/api/v1/solicitacoes', $this->dados())->assertStatus(415);
    }

    public function test_erros_internos_nao_expoem_detalhes_mesmo_com_debug(): void
    {
        config(['app.debug' => true]);
        Route::get('/api/v1/falha-teste', static function (): never {
            throw new RuntimeException('DETALHE_INTERNO_FICTICIO');
        });
        $this->get('/api/v1/falha-teste')->assertStatus(500)
            ->assertExactJson([
                'message' => 'Ocorreu um erro interno. Tente novamente mais tarde.',
                'errors' => [],
            ])->assertDontSee('DETALHE_INTERNO_FICTICIO');
    }
}
