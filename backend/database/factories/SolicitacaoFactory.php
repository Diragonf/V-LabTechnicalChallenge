<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Solicitacao;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Solicitacao> */
final class SolicitacaoFactory extends Factory
{
    protected $model = Solicitacao::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $categoria = $this->faker->randomElement(['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO']);
        $criacao = $this->faker->dateTimeBetween('-30 days', 'now');

        return [
            'protocolo' => 'SOL-'.$criacao->format('Ymd').'-'.strtoupper(bin2hex(random_bytes(8))),
            'nome_solicitante' => 'Pessoa fictícia — '.$this->faker->firstName().' '.$this->faker->lastName(),
            'categoria' => $categoria,
            'prioridade' => $this->faker->randomElement(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']),
            'status' => $this->faker->randomElement(['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA']),
            'descricao' => 'Cenário fictício: '.$this->faker->randomElement([
                'agendamento de atendimento em unidade de saúde simulada.',
                'acompanhamento de solicitação em serviço público simulado.',
                'encaminhamento para atendimento em rede de saúde simulada.',
            ]),
            'justificativa_prioridade' => null,
            'data_criacao' => $criacao,
            'data_atualizacao' => $this->faker->dateTimeBetween($criacao, 'now'),
        ];
    }

    public function configure(): static
    {
        // Executa após os states, inclusive quando a prioridade é sobrescrita no seeder.
        return $this->afterMaking(function (Solicitacao $solicitacao): void {
            if ($solicitacao->prioridade === 'URGENTE'
                && ($solicitacao->justificativa_prioridade === null
                    || preg_match('/^\s*$/u', $solicitacao->justificativa_prioridade) === 1)) {
                $solicitacao->justificativa_prioridade = 'Justificativa fictícia: '.$this->faker->randomElement([
                    'necessidade de avaliação prioritária em cenário de treinamento.',
                    'encaminhamento prioritário simulado para testar o fluxo de atendimento.',
                    'prazo reduzido de atendimento em exercício de demonstração.',
                ]);
            }
        });
    }

    public function urgente(): static
    {
        return $this->state(fn (array $attributes): array => ['prioridade' => 'URGENTE']);
    }
}
