<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Exceptions\InvalidStatusTransitionException;
use App\Services\SolicitacaoService;
use Illuminate\Container\Container;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidatorFactory;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SolicitacaoServiceTest extends TestCase
{
    #[DataProvider('transicoes')]
    public function test_valida_maquina_de_estados_sem_banco(string $atual, string $novo, bool $permitida): void
    {
        $service = new SolicitacaoService;
        if (! $permitida) {
            $this->expectException(InvalidStatusTransitionException::class);
            $this->expectExceptionMessage("A transição de {$atual} para {$novo} não é permitida.");
        }

        $service->validarTransicao($atual, $novo);
        $this->addToAssertionCount(1);
    }

    /** @return iterable<string, array{string, string, bool}> */
    public static function transicoes(): iterable
    {
        $permitidas = [
            'RECEBIDA' => ['EM_ANALISE', 'CANCELADA'],
            'EM_ANALISE' => ['AGENDADA', 'CANCELADA'],
            'AGENDADA' => ['CONCLUIDA', 'CANCELADA'],
            'CONCLUIDA' => [],
            'CANCELADA' => [],
        ];
        foreach ($permitidas as $atual => $destinos) {
            foreach (array_keys($permitidas) as $novo) {
                yield "{$atual} -> {$novo}" => [$atual, $novo, in_array($novo, $destinos, true)];
            }
        }
        yield 'origem desconhecida' => ['INVALIDO', 'RECEBIDA', false];
        yield 'destino desconhecido' => ['RECEBIDA', 'INVALIDO', false];
    }

    #[DataProvider('justificativasInvalidas')]
    public function test_service_rejeita_urgencia_antes_de_acessar_banco(array $complemento): void
    {
        // Container mínimo: sem bootstrap Laravel, HTTP, migrations ou conexão de banco.
        $anterior = Facade::getFacadeApplication();
        $container = new Container;
        $container->instance('validator', new ValidatorFactory(new Translator(new ArrayLoader, 'pt_BR')));
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication($container);

        try {
            (new SolicitacaoService)->criar(array_merge([
                'nome_solicitante' => 'Pessoa Fictícia Unitária',
                'categoria' => 'CONSULTA',
                'prioridade' => 'URGENTE',
                'descricao' => 'Cenário fictício de teste.',
            ], $complemento));
            $this->fail('Era esperada uma exceção de validação antes da persistência.');
        } catch (ValidationException $exception) {
            $this->assertSame([
                'justificativa_prioridade' => ['A justificativa é obrigatória para prioridade URGENTE.'],
            ], $exception->errors());
        } finally {
            Facade::clearResolvedInstances();
            Facade::setFacadeApplication($anterior);
        }
    }

    /** @return iterable<string, array{array<string, string|null>}> */
    public static function justificativasInvalidas(): iterable
    {
        yield 'ausente' => [[]];
        yield 'nula' => [['justificativa_prioridade' => null]];
        yield 'vazia' => [['justificativa_prioridade' => '']];
        yield 'espaços' => [['justificativa_prioridade' => " \t\n "]];
        yield 'espaço Unicode' => [['justificativa_prioridade' => "\u{00A0}"]];
    }
}
