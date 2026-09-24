<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\InvalidStatusTransitionException;
use App\Models\Solicitacao;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class SolicitacaoService
{
    private const MAX_TENTATIVAS_PROTOCOLO = 5;

    /** @var array<string, list<string>> */
    private const TRANSICOES = [
        'RECEBIDA' => ['EM_ANALISE', 'CANCELADA'],
        'EM_ANALISE' => ['AGENDADA', 'CANCELADA'],
        'AGENDADA' => ['CONCLUIDA', 'CANCELADA'],
        'CONCLUIDA' => [],
        'CANCELADA' => [],
    ];

    /**
     * Recebe os dados previamente validados pelo Form Request.
     * Protocolo e status inicial são sempre definidos pela aplicação.
     *
     * @param array{
     *     nome_solicitante: string,
     *     categoria: string,
     *     prioridade: string,
     *     descricao: string,
     *     justificativa_prioridade?: string|null
     * } $dados
     */
    public function criar(array $dados): Solicitacao
    {
        $justificativa = $dados['justificativa_prioridade'] ?? null;

        if ($dados['prioridade'] === 'URGENTE'
            && ($justificativa === null || preg_match('/^\s*$/u', $justificativa) === 1)) {
            throw ValidationException::withMessages([
                'justificativa_prioridade' => 'A justificativa é obrigatória para prioridade URGENTE.',
            ]);
        }

        for ($tentativa = 0; $tentativa < self::MAX_TENTATIVAS_PROTOCOLO; $tentativa++) {
            try {
                return DB::transaction(function () use ($dados, $justificativa): Solicitacao {
                    return Solicitacao::query()->create([
                        'protocolo' => $this->gerarProtocolo(),
                        'nome_solicitante' => $dados['nome_solicitante'],
                        'categoria' => $dados['categoria'],
                        'prioridade' => $dados['prioridade'],
                        'status' => 'RECEBIDA',
                        'descricao' => $dados['descricao'],
                        'justificativa_prioridade' => $justificativa,
                    ]);
                });
            } catch (UniqueConstraintViolationException $exception) {
                // No PostgreSQL, repita somente após o rollback da transação.
                // Outras violações de unicidade não devem ser mascaradas.
                if (! str_contains($exception->getMessage(), 'solicitacoes_protocolo_unique')) {
                    throw $exception;
                }
            }
        }

        throw new RuntimeException('Não foi possível gerar um protocolo único. Tente novamente.');
    }

    /** @param array{status?: string, categoria?: string, prioridade?: string, page?: int|string, per_page?: int|string} $filtros */
    public function listar(array $filtros = []): LengthAwarePaginator
    {
        $query = Solicitacao::query();

        foreach (['status', 'categoria', 'prioridade'] as $campo) {
            if (isset($filtros[$campo])) {
                $query->where($campo, $filtros[$campo]);
            }
        }

        return $query->orderByDesc('id')
            ->paginate((int) ($filtros['per_page'] ?? 15), ['*'], 'page', (int) ($filtros['page'] ?? 1))
            ->appends($filtros);
    }

    public function detalhar(int|string $solicitacaoId): Solicitacao
    {
        $this->validarId($solicitacaoId);

        return Solicitacao::query()->findOrFail($solicitacaoId);
    }

    public function atualizarStatus(int|string $solicitacaoId, string $novoStatus): Solicitacao
    {
        $this->validarId($solicitacaoId);

        return DB::transaction(function () use ($solicitacaoId, $novoStatus): Solicitacao {
            // Leia o estado atual sob bloqueio, evitando transições concorrentes obsoletas.
            $solicitacao = Solicitacao::query()
                ->lockForUpdate()
                ->findOrFail($solicitacaoId);

            $statusAtual = (string) $solicitacao->status;

            $this->validarTransicao($statusAtual, $novoStatus);

            $solicitacao->status = $novoStatus;
            $solicitacao->save();

            return $solicitacao;
        });
    }

    public function validarTransicao(string $statusAtual, string $novoStatus): void
    {
        if (! in_array($novoStatus, self::TRANSICOES[$statusAtual] ?? [], true)) {
            throw new InvalidStatusTransitionException($statusAtual, $novoStatus);
        }
    }

    private function validarId(int|string $id): void
    {
        // Evita overflow de bigint no PostgreSQL e mantém IDs inválidos como 404.
        if (filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
            throw (new ModelNotFoundException)->setModel(Solicitacao::class);
        }
    }

    private function gerarProtocolo(): string
    {
        // Sufixo de 16 caracteres para reduzir colisões; o índice UNIQUE é a garantia final.
        return 'SOL-'.now()->format('Ymd').'-'.strtoupper(bin2hex(random_bytes(8)));
    }
}
