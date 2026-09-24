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
        $primeira = $this->postJson('/api/v1/solicitacoes', $this->dados())
            ->assertCreated()
            ->assertJsonPath('data.status', 'RECEBIDA')
            ->assertJsonPath('data.justificativa_prioridade', null);
        $segunda = $this->postJson('/api/v1/solicitacoes', $this->dados())->assertCreated();

        $this->assertMatchesRegularExpression('/^SOL-[0-9]{8}-[A-F0-9]{16}$/', $primeira->json('data.protocolo'));
        $this->assertNotSame($primeira->json('data.protocolo'), $segunda->json('data.protocolo'));
        $this->assertDatabaseCount('solicitacoes', 2);
        $this->getJson('/api/v1/solicitacoes/'.$primeira->json('data.id'))
            ->assertOk()->assertJsonPath('data.nome_solicitante', 'Pessoa Fictícia Alfa');
    }

    public function test_urgente_exige_justificativa_com_texto(): void
    {
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
                    $resposta->assertStatus(400)->assertExactJson([
                        'message' => 'A transição de status solicitada não é permitida.',
                        'errors' => [],
                    ]);
                    $this->assertDatabaseHas('solicitacoes', ['id' => $id, 'status' => $atual]);
                }
            }
        }
    }

    public function test_lista_com_filtros_combinados_e_paginacao(): void
    {
        $ids = [];
        for ($i = 0; $i < 3; $i++) {
            $ids[] = $this->postJson('/api/v1/solicitacoes', $this->dados())->assertCreated()->json('data.id');
        }
        $this->postJson('/api/v1/solicitacoes', array_merge($this->dados(), ['categoria' => 'EXAME']))->assertCreated();
        $this->getJson('/api/v1/solicitacoes?status=RECEBIDA&categoria=CONSULTA&prioridade=MEDIA&per_page=2&page=1')
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.per_page', 2)->assertJsonPath('data.0.id', $ids[2]);
        $this->getJson('/api/v1/solicitacoes?status=RECEBIDA&categoria=CONSULTA&prioridade=MEDIA&per_page=2&page=2')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.current_page', 2);
        $this->getJson('/api/v1/solicitacoes?page=100')->assertOk()->assertJsonCount(0, 'data');
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
